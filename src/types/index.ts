// Card value can be a number, string (for special cards like ?, coffee), or null
export type CardValue = number | string | null;

// Deck types available in the app
export type DeckType = "fibonacci" | "fibonacciMini" | "tshirt" | "powers2" | "sequential" | "custom";

// Room settings configuration
export interface RoomSettings {
  allowRevote: boolean;
  autoReveal: boolean;
  showAverage: boolean;
  timerEnabled: boolean;
  timerDuration: number; // in seconds
}

// Room data structure
export interface Room {
  id: string;
  name: string;
  deckType: DeckType;
  customDeck?: CardValue[];
  settings: RoomSettings;
  createdAt: Date;
  createdBy: string;
}

// Participant in a room (transient, not persisted)
export interface Participant {
  id: string;
  name: string;
  isSpectator: boolean;
  isModerator: boolean;
  hasVoted: boolean;
  currentVote?: CardValue;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
}

// Story to be estimated
export interface Story {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  order: number;
  status: "pending" | "voting" | "revealed" | "skipped";
  finalEstimate?: CardValue;
  createdAt: Date;
  estimatedAt?: Date;
  // Cached voting results for recall
  cachedVotes?: Vote[];
  cachedStats?: VotingStats;
}

// Vote record
export interface Vote {
  participantId: string;
  participantName: string;
  storyId: string;
  value: CardValue;
  timestamp: Date;
}

// Voting round state
export interface VotingRound {
  storyId: string;
  status: "voting" | "revealed";
  votes: Record<string, Vote>;
  startedAt: Date;
  revealedAt?: Date;
  timerEndsAt?: Date;
}

// Chat message
export interface ChatMessage {
  id: string;
  participantId: string;
  participantName: string;
  content: string;
  timestamp: Date;
  type: "message" | "system";
}

// Timer state
export interface TimerState {
  isRunning: boolean;
  remaining: number; // seconds
  endsAt?: Date;
}

// Voting statistics after reveal
export interface VotingStats {
  storyId: string;
  votes: Vote[];
  average: number | null;
  median: number | null;
  mode: CardValue[];
  consensus: boolean;
  spread: number | null;
  distribution: Record<string, number>;
}

// Full room state for synchronization
export interface RoomState {
  room: Room;
  participants: Participant[];
  stories: Story[];
  currentStoryId: string | null;
  votingRound: VotingRound | null;
  chatMessages: ChatMessage[];
  timer: TimerState | null;
}

// WebSocket message types from client to server
export type ClientMessage =
  | { type: "join"; participantId: string; name: string; isSpectator: boolean }
  | { type: "leave" }
  | { type: "vote"; storyId: string; value: CardValue }
  | { type: "clearVote" }
  | { type: "reveal" }
  | { type: "resetVotes" }
  | { type: "nextStory"; storyId: string }
  | { type: "startTimer" }
  | { type: "pauseTimer" }
  | { type: "resetTimer" }
  | { type: "chat"; content: string }
  | { type: "addStory"; story: Omit<Story, "id" | "roomId" | "createdAt"> }
  | { type: "updateStory"; storyId: string; updates: Partial<Story> }
  | { type: "deleteStory"; storyId: string }
  | { type: "reorderStories"; storyIds: string[] }
  | { type: "setFinalEstimate"; storyId: string; value: CardValue }
  | { type: "updateSettings"; settings: Partial<RoomSettings> }
  | { type: "kickParticipant"; participantId: string }
  | { type: "promoteModerator"; participantId: string };

// WebSocket message types from server to client
export type ServerMessage =
  | { type: "sync"; state: RoomState }
  | { type: "participantJoined"; participant: Participant }
  | { type: "participantLeft"; participantId: string }
  | { type: "participantUpdated"; participant: Participant }
  | { type: "voteReceived"; participantId: string }
  | { type: "votesRevealed"; votes: Vote[]; stats: VotingStats }
  | { type: "votesCleared" }
  | { type: "storyChanged"; storyId: string }
  | { type: "storiesUpdated"; stories: Story[] }
  | { type: "timerTick"; remaining: number }
  | { type: "timerStarted"; endsAt: Date }
  | { type: "timerPaused"; remaining: number }
  | { type: "timerExpired" }
  | { type: "chatMessage"; message: ChatMessage }
  | { type: "settingsUpdated"; settings: RoomSettings }
  | { type: "error"; message: string; code: string };
