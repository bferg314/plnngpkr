"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { nanoid } from "nanoid";
import { useRoomStore } from "@/stores/roomStore";
// Server message types are handled inline

export function useSocket(roomId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setConnectionState,
    syncState,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setVoteReceived,
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
        console.log("Socket connected");
        setConnectionState(true, false);

        // Join room
        socket.emit("join", {
          roomId,
          participantId: pid,
          name,
          isSpectator,
        });
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setConnectionState(false, false);
      });

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error);
        setConnectionState(false, false, error.message);
      });

      // Handle server messages
      socket.on("sync", (data: { state: any }) => {
        syncState(data.state);
      });

      socket.on("participantJoined", (data: { participant: any }) => {
        addParticipant(data.participant);
      });

      socket.on("participantLeft", (data: { participantId: string }) => {
        removeParticipant(data.participantId);
      });

      socket.on("participantUpdated", (data: { participant: any }) => {
        updateParticipant(data.participant);
      });

      socket.on("voteReceived", (data: { participantId: string }) => {
        setVoteReceived(data.participantId);
      });

      socket.on("votesRevealed", (data: { votes: any[]; stats: any }) => {
        revealVotes(data.votes, data.stats);
      });

      socket.on("votesCleared", () => {
        clearVotes();
      });

      socket.on("storyChanged", (data: { storyId: string | null }) => {
        setCurrentStory(data.storyId);
      });

      socket.on("storiesUpdated", (data: { stories: any[] }) => {
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

      socket.on("chatMessage", (data: { message: any }) => {
        addChatMessage(data.message);
      });

      socket.on("settingsUpdated", (data: { settings: any }) => {
        updateSettings(data.settings);
      });

      socket.on("error", (data: { message: string; code: string }) => {
        console.error("Server error:", data.message);
        setConnectionState(false, false, data.message);
      });
    },
    [roomId, participantId]
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
  const vote = useCallback((storyId: string, value: any) => {
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

  const addStory = useCallback((story: any) => {
    socketRef.current?.emit("addStory", { story });
  }, []);

  const updateStory = useCallback((storyId: string, updates: any) => {
    socketRef.current?.emit("updateStory", { storyId, updates });
  }, []);

  const deleteStory = useCallback((storyId: string) => {
    socketRef.current?.emit("deleteStory", { storyId });
  }, []);

  const reorderStories = useCallback((storyIds: string[]) => {
    socketRef.current?.emit("reorderStories", { storyIds });
  }, []);

  const setFinalEstimate = useCallback((storyId: string, value: any) => {
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

  const changeSettings = useCallback((settings: any) => {
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
