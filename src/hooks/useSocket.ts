"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useRoomStore } from "@/stores/roomStore";
import type {
  RoomState,
  Participant,
  Vote,
  VotingStats,
  Story,
  ChatMessage,
  RoomSettings,
  CardValue,
} from "@/types";

export function useSocket(roomId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setConnectionState,
    syncState,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setVoteReceived,
    setVoteCleared,
    revealVotes,
    clearVotes,
    setCurrentStory,
    updateStories,
    setTimerTick,
    startTimer,
    pauseTimer,
    expireTimer,
    addChatMessage,
    updateSettings,
    participantId,
  } = useRoomStore();

  // Connect to room
  const connect = useCallback(
    (name: string, isSpectator: boolean) => {
      if (!roomId) return;

      const pid = participantId || nanoid();
      useRoomStore.getState().setParticipant(pid, name);

      // Store participant ID in localStorage for reconnection
      localStorage.setItem("plnngpkr_participant_id", pid);
      localStorage.setItem("plnngpkr_participant_name", name);

      setConnectionState(false, true);

      const socket = io({
        path: "/socket.io",
        transports: ["websocket", "polling"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setConnectionState(true, false);

        // Join room
        socket.emit("join", {
          roomId,
          participantId: pid,
          name,
          isSpectator,
        });
      });

      socket.on("disconnect", () => {
        setConnectionState(false, false);
      });

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error);
        setConnectionState(false, false, error.message);
      });

      // Handle server messages
      socket.on("sync", (data: { state: RoomState }) => {
        syncState(data.state);
      });

      socket.on("participantJoined", (data: { participant: Participant }) => {
        addParticipant(data.participant);
      });

      socket.on("participantLeft", (data: { participantId: string }) => {
        removeParticipant(data.participantId);
      });

      socket.on("participantUpdated", (data: { participant: Participant }) => {
        updateParticipant(data.participant);
      });

      socket.on("voteReceived", (data: { participantId: string }) => {
        setVoteReceived(data.participantId);
      });

      socket.on("voteCleared", (data: { participantId: string }) => {
        setVoteCleared(data.participantId);
      });

      socket.on("votesRevealed", (data: { votes: Vote[]; stats: VotingStats }) => {
        revealVotes(data.votes, data.stats);
      });

      socket.on("votesCleared", () => {
        clearVotes();
      });

      socket.on("storyChanged", (data: { storyId: string | null }) => {
        setCurrentStory(data.storyId);
      });

      socket.on("storiesUpdated", (data: { stories: Story[] }) => {
        updateStories(data.stories);
      });

      socket.on("timerStarted", (data: { endsAt: string }) => {
        startTimer(new Date(data.endsAt));
      });

      socket.on("timerTick", (data: { remaining: number }) => {
        setTimerTick(data.remaining);
      });

      socket.on("timerPaused", (data: { remaining: number }) => {
        pauseTimer(data.remaining);
      });

      socket.on("timerExpired", () => {
        expireTimer();
      });

      socket.on("timerReset", () => {
        useRoomStore.setState({ timer: null });
      });

      socket.on("chatMessage", (data: { message: ChatMessage }) => {
        addChatMessage(data.message);
      });

      socket.on("settingsUpdated", (data: { settings: RoomSettings }) => {
        updateSettings(data.settings);
      });

      socket.on("kicked", () => {
        socket.disconnect();
        setConnectionState(
          false,
          false,
          "You were removed from the room by the moderator."
        );
      });

      socket.on("rateLimited", (data: { message: string }) => {
        toast.error(data.message);
      });

      socket.on("error", (data: { message: string; code: string }) => {
        console.error("Server error:", data.message);
        setConnectionState(false, false, data.message);
      });
    },
    [
      roomId,
      participantId,
      setConnectionState,
      syncState,
      addParticipant,
      removeParticipant,
      updateParticipant,
      setVoteReceived,
      setVoteCleared,
      revealVotes,
      clearVotes,
      setCurrentStory,
      updateStories,
      startTimer,
      setTimerTick,
      pauseTimer,
      expireTimer,
      addChatMessage,
      updateSettings,
    ]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionState(false, false);
  }, [setConnectionState]);

  // Actions
  const vote = useCallback((storyId: string, value: CardValue) => {
    socketRef.current?.emit("vote", { storyId, value });
  }, []);

  const clearVote = useCallback(() => {
    socketRef.current?.emit("clearVote");
  }, []);

  const reveal = useCallback(() => {
    socketRef.current?.emit("reveal");
  }, []);

  const resetVotes = useCallback(() => {
    socketRef.current?.emit("resetVotes");
  }, []);

  const nextStory = useCallback((storyId: string | null) => {
    socketRef.current?.emit("nextStory", { storyId });
  }, []);

  const addStory = useCallback((story: Omit<Story, "id" | "roomId" | "createdAt">) => {
    socketRef.current?.emit("addStory", { story });
  }, []);

  const updateStory = useCallback((storyId: string, updates: Partial<Story>) => {
    socketRef.current?.emit("updateStory", { storyId, updates });
  }, []);

  const deleteStory = useCallback((storyId: string) => {
    socketRef.current?.emit("deleteStory", { storyId });
  }, []);

  const reorderStories = useCallback((storyIds: string[]) => {
    socketRef.current?.emit("reorderStories", { storyIds });
  }, []);

  const setFinalEstimate = useCallback((storyId: string, value: CardValue) => {
    socketRef.current?.emit("setFinalEstimate", { storyId, value });
  }, []);

  const sendChat = useCallback((content: string) => {
    socketRef.current?.emit("chat", { content });
  }, []);

  const startTimerAction = useCallback(() => {
    socketRef.current?.emit("startTimer");
  }, []);

  const pauseTimerAction = useCallback(() => {
    socketRef.current?.emit("pauseTimer");
  }, []);

  const resetTimerAction = useCallback(() => {
    socketRef.current?.emit("resetTimer");
  }, []);

  const changeSettings = useCallback((settings: Partial<RoomSettings>) => {
    socketRef.current?.emit("updateSettings", { settings });
  }, []);

  const kickParticipant = useCallback((pid: string) => {
    socketRef.current?.emit("kickParticipant", { participantId: pid });
  }, []);

  const promoteModerator = useCallback((pid: string) => {
    socketRef.current?.emit("promoteModerator", { participantId: pid });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    vote,
    clearVote,
    reveal,
    resetVotes,
    nextStory,
    addStory,
    updateStory,
    deleteStory,
    reorderStories,
    setFinalEstimate,
    sendChat,
    startTimer: startTimerAction,
    pauseTimer: pauseTimerAction,
    resetTimer: resetTimerAction,
    changeSettings,
    kickParticipant,
    promoteModerator,
  };
}
