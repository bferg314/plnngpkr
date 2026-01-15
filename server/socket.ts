import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { Participant, CardValue, Story, RoomSettings } from "../src/types";
import * as rooms from "./rooms";

// Map socket ID to participant info for reconnection
const socketToParticipant = new Map<
  string,
  { roomId: string; participantId: string }
>();

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
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

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room
    socket.on("join", (data: { roomId: string; participantId: string; name: string; isSpectator: boolean }) => {
      const { roomId, participantId, name, isSpectator } = data;

      // Check if room exists
      const roomState = rooms.getRoomState(roomId);
      if (!roomState) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      // Create or update participant
      const participant: Participant = {
        id: participantId,
        name,
        isSpectator,
        isModerator: false,
        hasVoted: false,
        connectionStatus: "connected",
      };

      const addedParticipant = rooms.addParticipant(roomId, participant);
      if (!addedParticipant) {
        socket.emit("error", { message: "Failed to join room", code: "JOIN_FAILED" });
        return;
      }

      // Store mapping
      socketToParticipant.set(socket.id, { roomId, participantId });

      // Join socket room
      socket.join(roomId);

      // Send full state to joining client
      const state = rooms.getRoomState(roomId);
      socket.emit("sync", { state });

      // Notify others
      socket.to(roomId).emit("participantJoined", { participant: addedParticipant });

      // Add system message
      const message = rooms.addSystemMessage(roomId, `${name} joined the room`);
      if (message) {
        io.to(roomId).emit("chatMessage", { message });
      }

      console.log(`${name} joined room ${roomId}`);
    });

    // Handle voting
    socket.on("vote", (data: { storyId: string; value: CardValue }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

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

    // Reveal votes
    socket.on("reveal", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const result = rooms.revealVotes(info.roomId);
      if (result) {
        io.to(info.roomId).emit("votesRevealed", result);
      }
    });

    // Reset votes
    socket.on("resetVotes", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.resetVotes(info.roomId);
      if (success) {
        io.to(info.roomId).emit("votesCleared");
      }
    });

    // Change story
    socket.on("nextStory", (data: { storyId: string | null }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const result = rooms.setCurrentStory(info.roomId, data.storyId);
      if (result.success) {
        io.to(info.roomId).emit("storyChanged", { storyId: data.storyId });

        // If story has cached votes, emit them as revealed
        if (result.cachedVotes && result.cachedStats) {
          io.to(info.roomId).emit("votesRevealed", { votes: result.cachedVotes, stats: result.cachedStats });
        }

        // Send updated state
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("sync", { state });
      }
    });

    // Story management
    socket.on("addStory", (data: { story: Omit<Story, "id" | "roomId" | "createdAt"> }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const story = rooms.addStory(info.roomId, data.story);
      if (story) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("updateStory", (data: { storyId: string; updates: Partial<Story> }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const story = rooms.updateStory(info.roomId, data.storyId, data.updates);
      if (story) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("deleteStory", (data: { storyId: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.deleteStory(info.roomId, data.storyId);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("reorderStories", (data: { storyIds: string[] }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.reorderStories(info.roomId, data.storyIds);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    socket.on("setFinalEstimate", (data: { storyId: string; value: CardValue }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.setFinalEstimate(info.roomId, data.storyId, data.value);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("storiesUpdated", { stories: state?.stories || [] });
      }
    });

    // Chat
    socket.on("chat", (data: { content: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const message = rooms.addChatMessage(info.roomId, info.participantId, data.content);
      if (message) {
        io.to(info.roomId).emit("chatMessage", { message });
      }
    });

    // Timer
    socket.on("startTimer", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

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
      if (!info) return;

      const remaining = rooms.pauseTimer(info.roomId);
      if (remaining !== null) {
        io.to(info.roomId).emit("timerPaused", { remaining });
      }
    });

    socket.on("resetTimer", () => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.resetTimer(info.roomId);
      if (success) {
        io.to(info.roomId).emit("timerReset");
      }
    });

    // Settings
    socket.on("updateSettings", (data: { settings: Partial<RoomSettings> }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const settings = rooms.updateSettings(info.roomId, data.settings);
      if (settings) {
        io.to(info.roomId).emit("settingsUpdated", { settings });
      }
    });

    // Moderator actions
    socket.on("kickParticipant", (data: { participantId: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.kickParticipant(info.roomId, data.participantId);
      if (success) {
        io.to(info.roomId).emit("participantLeft", { participantId: data.participantId });
      }
    });

    socket.on("promoteModerator", (data: { participantId: string }) => {
      const info = socketToParticipant.get(socket.id);
      if (!info) return;

      const success = rooms.promoteModerator(info.roomId, data.participantId);
      if (success) {
        const state = rooms.getRoomState(info.roomId);
        io.to(info.roomId).emit("sync", { state });
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
        io.to(info.roomId).emit("participantUpdated", { participant });
      }

      // Remove from tracking after timeout (allow reconnection)
      setTimeout(() => {
        const currentInfo = socketToParticipant.get(socket.id);
        if (currentInfo) {
          const room = rooms.getRoom(currentInfo.roomId);
          const p = room?.participants.get(currentInfo.participantId);

          // If still disconnected, remove participant
          if (p && p.connectionStatus === "disconnected") {
            rooms.removeParticipant(currentInfo.roomId, currentInfo.participantId);
            io.to(currentInfo.roomId).emit("participantLeft", {
              participantId: currentInfo.participantId
            });

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
    });
  });

  return io;
}
