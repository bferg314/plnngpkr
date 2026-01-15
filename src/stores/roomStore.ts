import { create } from "zustand";
import type {
  Room,
  Participant,
  Story,
  VotingRound,
  ChatMessage,
  TimerState,
  CardValue,
  RoomState,
  Vote,
  VotingStats,
  RoomSettings,
} from "@/types";

interface RoomStore {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Room state
  room: Room | null;
  participants: Participant[];
  stories: Story[];
  currentStoryId: string | null;
  votingRound: VotingRound | null;
  chatMessages: ChatMessage[];
  timer: TimerState | null;
  votingStats: VotingStats | null;

  // Current user
  participantId: string | null;
  participantName: string | null;

  // UI state
  isChatOpen: boolean;
  isStoriesOpen: boolean;

  // Actions
  setConnectionState: (isConnected: boolean, isConnecting: boolean, error?: string | null) => void;
  syncState: (state: RoomState) => void;
  setParticipant: (id: string, name: string) => void;

  // Participant actions
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (participant: Participant) => void;

  // Voting actions
  setVoteReceived: (participantId: string) => void;
  revealVotes: (votes: Vote[], stats: VotingStats) => void;
  clearVotes: () => void;
  setCurrentStory: (storyId: string | null) => void;

  // Story actions
  updateStories: (stories: Story[]) => void;

  // Timer actions
  setTimerTick: (remaining: number) => void;
  startTimer: (endsAt: Date) => void;
  pauseTimer: (remaining: number) => void;
  expireTimer: () => void;

  // Chat actions
  addChatMessage: (message: ChatMessage) => void;
  toggleChat: () => void;
  toggleStories: () => void;

  // Settings actions
  updateSettings: (settings: RoomSettings) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  room: null,
  participants: [],
  stories: [],
  currentStoryId: null,
  votingRound: null,
  chatMessages: [],
  timer: null,
  votingStats: null,
  participantId: null,
  participantName: null,
  isChatOpen: false,
  isStoriesOpen: true,
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  ...initialState,

  setConnectionState: (isConnected, isConnecting, error = null) =>
    set({ isConnected, isConnecting, connectionError: error }),

  syncState: (state) =>
    set({
      room: state.room,
      participants: state.participants,
      stories: state.stories,
      currentStoryId: state.currentStoryId,
      votingRound: state.votingRound,
      chatMessages: state.chatMessages,
      timer: state.timer,
    }),

  setParticipant: (id, name) =>
    set({ participantId: id, participantName: name }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    })),

  updateParticipant: (participant) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participant.id ? participant : p
      ),
    })),

  setVoteReceived: (participantId) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, hasVoted: true } : p
      ),
    })),

  revealVotes: (votes, stats) =>
    set((state) => {
      // Update participants with their revealed votes
      const voteMap = new Map(votes.map((v) => [v.participantId, v.value]));
      const updatedParticipants = state.participants.map((p) => ({
        ...p,
        currentVote: voteMap.get(p.id) ?? null,
      }));

      return {
        participants: updatedParticipants,
        votingRound: state.votingRound
          ? { ...state.votingRound, status: "revealed" as const }
          : null,
        votingStats: stats,
      };
    }),

  clearVotes: () =>
    set((state) => ({
      participants: state.participants.map((p) => ({
        ...p,
        hasVoted: false,
        currentVote: undefined,
      })),
      votingRound: state.votingRound
        ? {
            ...state.votingRound,
            status: "voting" as const,
            votes: {},
            revealedAt: undefined,
          }
        : null,
      votingStats: null,
    })),

  setCurrentStory: (storyId) =>
    set((state) => ({
      currentStoryId: storyId,
      // Reset voting state when changing stories
      votingRound: storyId
        ? {
            storyId,
            status: "voting",
            votes: {},
            startedAt: new Date(),
          }
        : null,
      participants: state.participants.map((p) => ({
        ...p,
        hasVoted: false,
        currentVote: undefined,
      })),
    })),

  updateStories: (stories) => set({ stories }),

  setTimerTick: (remaining) =>
    set((state) => ({
      timer: state.timer ? { ...state.timer, remaining } : null,
    })),

  startTimer: (endsAt) =>
    set((state) => ({
      timer: {
        isRunning: true,
        remaining: Math.ceil((endsAt.getTime() - Date.now()) / 1000),
        endsAt,
      },
    })),

  pauseTimer: (remaining) =>
    set((state) => ({
      timer: state.timer
        ? { ...state.timer, isRunning: false, remaining, endsAt: undefined }
        : null,
    })),

  expireTimer: () =>
    set((state) => ({
      timer: state.timer
        ? { ...state.timer, isRunning: false, remaining: 0 }
        : null,
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  toggleStories: () =>
    set((state) => ({ isStoriesOpen: !state.isStoriesOpen })),

  updateSettings: (settings) =>
    set((state) => ({
      room: state.room ? { ...state.room, settings } : null,
    })),

  reset: () => set(initialState),
}));

// Selectors
export const selectCurrentStory = (state: RoomStore) =>
  state.stories.find((s) => s.id === state.currentStoryId);

export const selectCurrentParticipant = (state: RoomStore) =>
  state.participants.find((p) => p.id === state.participantId);

export const selectIsCurrentUserModerator = (state: RoomStore) => {
  const participant = selectCurrentParticipant(state);
  return participant?.isModerator ?? false;
};

export const selectVotingParticipants = (state: RoomStore) =>
  state.participants.filter((p) => !p.isSpectator);

export const selectSpectators = (state: RoomStore) =>
  state.participants.filter((p) => p.isSpectator);

export const selectAllVoted = (state: RoomStore) => {
  const votingParticipants = selectVotingParticipants(state);
  return (
    votingParticipants.length > 0 &&
    votingParticipants.every((p) => p.hasVoted)
  );
};

export const selectPendingStories = (state: RoomStore) =>
  state.stories.filter((s) => s.status === "pending" || s.status === "voting");

export const selectCompletedStories = (state: RoomStore) =>
  state.stories.filter((s) => s.status === "revealed");
