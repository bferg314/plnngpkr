import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { Participant, CardValue, Story, RoomSettings } from "../src/types";
import * as rooms from "./rooms";
import { RateLimiter, LIMITS, eventGroup, clientIp, type RateLimit } from "./rateLimit";

// Map socket ID to participant info for reconnection
const socketToParticipant = new Map<
  string,
  { roomId: string; participantId: string }
>();

export interface SocketServerOptions {
  limits?: Partial<typeof LIMITS>;
}

export function initializeSocketIO(
  httpServer: HTTPServer,
  options: SocketServerOptions = {}
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:3000"],
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const limits = { ...LIMITS, ...options.limits };
  const limiters = new Map<string, RateLimiter>();
  const limiterFor = (name: string, limit: RateLimit) => {
    let limiter = limiters.get(name);
    if (!limiter) {
      limiter = new RateLimiter(limit);
      limiters.set(name, limiter);
    }
    return limiter;
  };
  const joinPerIp = limiterFor("joinPerIp", limits.joinPerIp);
  const pruneInterval = setInterval(() => {
    for (const limiter of limiters.values()) limiter.prune();
  }, 60_000);
  pruneInterval.unref();

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    const ip = clientIp(socket.handshake.address, socket.handshake.headers);
    // One rateLimited notice per throttled streak, not one per dropped event
    const throttled = new Set<string>();

    // Drop events over their limit and tell the sender once
    socket.use(([event], next) => {
      const group = eventGroup(event);
      let result = limiterFor(group, limits[group]).take(socket.id);
      if (result.allowed && event === "join") {
        result = joinPerIp.take(ip);
      }
      if (result.allowed) {
        throttled.delete(group);
        next();
        return;
      }
      if (!throttled.has(group)) {
        throttled.add(group);
        socket.emit("rateLimited", {
          event,
          retryAfterMs: result.retryAfterMs,
          message: `You're doing that too fast. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`,
        });
      }
    });

    socket.on("disconnect", () => {
      for (const [name, limiter] of limiters) {
        if (name !== "joinPerIp") limiter.delete(socket.id);
      }
    });

    // Join room
    socket.on("join", async (data: { roomId: string; participantId: string; name: string; isSpectator: boolean }) => {
      if (!data || !data.roomId || !data.participantId || !data.name?.trim()) {
        socket.emit("error", { message: "Invalid join parameters", code: "INVALID_PARAMS" });
        return;
      }

      const { roomId, participantId, isSpectator } = data;
      const name = data.name.trim().slice(0, 60);

      // Hydrate from DB if not in memory
      if (!rooms.getRoom(roomId)) {
        await rooms.hydrateRoomFromDb(roomId);
      }

      // Check if room exists
      const roomState = rooms.getRoomState(roomId);
      if (!roomState) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      // Check if participant already exists (reconnecting)
      const room = rooms.getRoom(roomId);
      const existingParticipant = room?.participants.get(participantId);

      let participant: Participant;
      let isRejoining = false;

      if (existingParticipant) {
        // Participant is rejoining - preserve their state but update connection info
        participant = {
          ...existingParticipant,
          name, // Allow name updates
          connectionStatus: "connected",
        };
        isRejoining = true;
      } else {
        // New participant joining
        participant = {
          id: participantId,
          name,
          isSpectator: Boolean(isSpectator),
          isModerator: false,
          hasVoted: false,
          connectionStatus: "connected",
        };
      }

      const addedParticipant = rooms.addParticipant(roomId, participant);
      if (!addedParticipant) {
        socket.emit("error", { message: "Failed to join room", code: "JOIN_FAILED" });
        return;
      }

      // Clean up any old socket mappings for this participant (if reconnecting)
      if (isRejoining) {
        for (const [socketId, info] of socketToParticipant.entries()) {
          if (info.participantId === participantId && info.roomId === roomId && socketId !== socket.id) {
            socketToParticipant.delete(socketId);
          }
        }
      }

      // Store new mapping
      socketToParticipant.set(socket.id, { roomId, participantId });

      // Join socket room
      socket.join(roomId);

      // Send full state to joining client (including their own unrevealed vote if any)
      const state = rooms.getRoomState(roomId, participantId);
      socket.emit("sync", { state });

      if (isRejoining) {
        // Notify others that participant reconnected
        socket.to(roomId).emit("participantUpdated", {
          participant: {
            ...addedParticipant,
            currentVote: state?.votingRound?.status === "revealed" ? addedParticipant.currentVote : undefined,
          },
        });

        // Add system message for reconnection
        const message = rooms.addSystemMessage(roomId, `${name} reconnected`);
        if (message) {
          io.to(roomId).emit("chatMessage", { message });
        }
      } else {
        // Notify others of new participant
        socket.to(roomId).emit("participantJoined", {
          participant: {
            ...addedParticipant,
            currentVote: undefined,
          },
        });

        // Add system message for new join
        const message = rooms.addSystemMessage(roomId, `${name} joined the room`);
        if (message) {
          io.to(roomId).emit("chatMessage", { message });
        }
      }

      console.log(`${name} ${isRejoining ? "rejoined" : "joined"} room ${roomId}`);
    });

    // Handle voting
    socket.on("vote", (data: { storyId: string; value: CardValue }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !data?.storyId || data.value === undefined) return;

      const success = rooms.submitVote(
        info.roomId,
        info.participantId,
        data.storyId,
        data.value
      );

      if (success) {
        io.to(info.roomId).emit("voteReceived", { participantId: info.participantId });

        // Check for auto-reveal
        const room = rooms.getRoom(info.roomId);
        if (room?.room.settings.autoReveal && rooms.checkAllVoted(info.roomId)) {
          const result = rooms.revealVotes(info.roomId);
          if (result) {
            io.to(info.roomId).emit("votesRevealed", result);
          }
        }
      }
    });

    // Clear vote
    socket.on("clearVote", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.clearVote(info.roomId, info.participantId);
      if (success) {
        io.to(info.roomId).emit("voteCleared", { participantId: info.participantId });
      }
    });

    // Reveal votes (moderator only)
    socket.on("reveal", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const result = rooms.revealVotes(info.roomId);
      if (result) {
        io.to(info.roomId).emit("votesRevealed", result);
        // Also broadcast updated story statuses (story status changed to "revealed")
        const state = rooms.getRoomState(info.roomId);
        if (state) {
          io.to(info.roomId).emit("storiesUpdated", { stories: state.stories });
        }
      }
    });

    // Reset votes (moderator only)
    socket.on("resetVotes", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const success = rooms.resetVotes(info.roomId);
      if (success) {
        io.to(info.roomId).emit("votesCleared");
        const state = rooms.getRoomState(info.roomId);
        if (state) {
          io.to(info.roomId).emit("storiesUpdated", { stories: state.stories });
        }
      }
    });

    // Change story (moderator only)
    socket.on("nextStory", (data: { storyId: string | null }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const result = rooms.setCurrentStory(info.roomId, data.storyId);
      if (result.success) {
        io.to(info.roomId).emit("storyChanged", { storyId: data.storyId });

        // Send updated state (includes votingStats if revealed)
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("sync", { state });

        // If story has cached votes, emit them as revealed
        if (result.cachedVotes && result.cachedStats) {
          io.to(info.roomId).emit("votesRevealed", { votes: result.cachedVotes, stats: result.cachedStats });
        }
      }
    });

    // Story management
    socket.on("addStory", (data: { story: Omit<Story, "id" | "roomId" | "createdAt"> }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !data?.story) return;

      const story = rooms.addStory(info.roomId, data.story);
      if (story) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("updateStory", (data: { storyId: string; updates: Partial<Story> }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !data?.storyId || !data?.updates) return;

      const story = rooms.updateStory(info.roomId, data.storyId, data.updates);
      if (story) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("deleteStory", (data: { storyId: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !data?.storyId) return;

      const activeRoom = rooms.getRoom(info.roomId);
      const wasCurrentStory = activeRoom?.currentStoryId === data.storyId;

      const success = rooms.deleteStory(info.roomId, data.storyId);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        if (wasCurrentStory) {
          io.to(info.roomId).emit("storyChanged", { storyId: null });
          io.to(info.roomId).emit("sync", { state });
        } else {
          io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
        }
      }
    });

    socket.on("reorderStories", (data: { storyIds: string[] }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !Array.isArray(data?.storyIds)) return;

      const success = rooms.reorderStories(info.roomId, data.storyIds);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("setFinalEstimate", (data: { storyId: string; value: CardValue }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const success = rooms.setFinalEstimate(info.roomId, data.storyId, data.value);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    // Chat
    socket.on("chat", (data: { content: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !data?.content) return;

      const message = rooms.addChatMessage(info.roomId, info.participantId, data.content);
      if (message) {
        io.to(info.roomId).emit("chatMessage", { message });
      }
    });

    // Timer (moderator only)
    socket.on("startTimer", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const endsAt = rooms.startTimer(
        info.roomId,
        (remaining) => {
          io.to(info.roomId).emit("timerTick", { remaining });
        },
        () => {
          io.to(info.roomId).emit("timerExpired");
        }
      );

      if (endsAt) {
        io.to(info.roomId).emit("timerStarted", { endsAt });
      }
    });

    socket.on("pauseTimer", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const remaining = rooms.pauseTimer(info.roomId);
      if (remaining !== null) {
        io.to(info.roomId).emit("timerPaused", { remaining });
      }
    });

    socket.on("resetTimer", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const success = rooms.resetTimer(info.roomId);
      if (success) {
        io.to(info.roomId).emit("timerReset");
      }
    });

    // Settings (moderator only)
    socket.on("updateSettings", (data: { settings: Partial<RoomSettings> }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info || !rooms.isParticipantModerator(info.roomId, info.participantId)) return;

      const settings = rooms.updateSettings(info.roomId, data.settings);
      if (settings) {
        io.to(info.roomId).emit("settingsUpdated", { settings });
      }
    });

    // Moderator actions
    socket.on("kickParticipant", (data: { participantId: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (
        !info ||
        !data?.participantId ||
        data.participantId === info.participantId ||
        !rooms.isParticipantModerator(info.roomId, info.participantId)
      ) {
        return;
      }

      const activeRoom = rooms.getRoom(info.roomId);
      const targetParticipant = activeRoom?.participants.get(data.participantId);

      const success = rooms.kickParticipant(info.roomId, data.participantId);
      if (success) {
        // Notify and remove kicked participant's socket(s) from the room
        for (const [sockId, sockInfo] of socketToParticipant.entries()) {
          if (sockInfo.roomId === info.roomId && sockInfo.participantId === data.participantId) {
            const targetSocket = io.sockets.sockets.get(sockId);
            if (targetSocket) {
              targetSocket.emit("kicked");
              targetSocket.leave(info.roomId);
            }
            socketToParticipant.delete(sockId);
          }
        }

        io.to(info.roomId).emit("participantLeft", { participantId: data.participantId });

        if (targetParticipant) {
          const message = rooms.addSystemMessage(
            info.roomId,
            `${targetParticipant.name} was removed from the room`
          );
          if (message) {
            io.to(info.roomId).emit("chatMessage", { message });
          }
        }
      }
    });

    socket.on("promoteModerator", (data: { participantId: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (
        !info ||
        !data?.participantId ||
        !rooms.isParticipantModerator(info.roomId, info.participantId)
      ) {
        return;
      }

      const success = rooms.promoteModerator(info.roomId, data.participantId);
      if (success) {
        const activeRoom = rooms.getRoom(info.roomId);
        const promoted = activeRoom?.participants.get(data.participantId);

        for (const [sockId, sockInfo] of socketToParticipant.entries()) {
          if (sockInfo.roomId === info.roomId) {
            const targetSocket = io.sockets.sockets.get(sockId);
            if (targetSocket) {
              targetSocket.emit("sync", {
                state: rooms.getRoomState(info.roomId, sockInfo.participantId),
              });
            }
          }
        }

        if (promoted) {
          const message = rooms.addSystemMessage(
            info.roomId,
            `${promoted.name} is now the moderator`
          );
          if (message) {
            io.to(info.roomId).emit("chatMessage", { message });
          }
        }
      }
    });

    // Disconnect handling
    socket.on("disconnect", (reason) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

      // Update connection status
      const participant = rooms.updateParticipantConnection(
        info.roomId,
        info.participantId,
        "disconnected"
      );

      if (participant) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("participantUpdated", {
          participant: {
            ...participant,
            currentVote: state?.votingRound?.status === "revealed" ? participant.currentVote : undefined,
          },
        });
      }

      // Remove from tracking after timeout (allow reconnection)
      const removeTimeout = setTimeout(() => {
        const currentInfo = socketToParticipant.get(socket.id);
        if (currentInfo) {
          const room = rooms.getRoom(currentInfo.roomId);
          const p = room?.participants.get(currentInfo.participantId);

          // If still disconnected, remove participant
          if (p && p.connectionStatus === "disconnected") {
            rooms.removeParticipant(currentInfo.roomId, currentInfo.participantId);
            io.to(currentInfo.roomId).emit("participantLeft", {
              participantId: currentInfo.participantId,
            });

            // Sync moderator state in case disconnected user was moderator
            const updatedState = rooms.getRoomState(currentInfo.roomId);
            if (updatedState) {
              for (const pUpdated of updatedState.participants) {
                if (pUpdated.isModerator) {
                  io.to(currentInfo.roomId).emit("participantUpdated", {
                    participant: pUpdated,
                  });
                }
              }
            }

            // Add system message
            const message = rooms.addSystemMessage(
              currentInfo.roomId,
              `${p.name} left the room`
            );
            if (message) {
              io.to(currentInfo.roomId).emit("chatMessage", { message });
            }
          }

          socketToParticipant.delete(socket.id);
        }
      }, 30000); // 30 second timeout for reconnection
      // The HTTP server keeps the process alive; this timer shouldn't on its own
      removeTimeout.unref();
    });
  });

  return io;
}
