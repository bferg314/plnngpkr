import type {
  Room,
  Participant,
  Story,
  VotingRound,
  ChatMessage,
  TimerState,
  RoomState,
  Vote,
  CardValue,
  RoomSettings,
  VotingStats,
} from "../src/types";
import { calculateVotingStats } from "../src/lib/utils/statistics";
import { nanoid } from "nanoid";

// In-memory store for active room states
// Using globalThis to ensure singleton across module reloads in development
const globalStore = globalThis as typeof globalThis & {
  __plnngpkr_rooms?: Map<string, ActiveRoom>;
};

interface ActiveRoom {
  room: Room;
  participants: Map<string, Participant>;
  stories: Story[];
  currentStoryId: string | null;
  votingRound: VotingRound | null;
  chatMessages: ChatMessage[];
  timer: TimerState | null;
  timerInterval?: NodeJS.Timeout;
}

// Initialize the global store if it doesn't exist
if (!globalStore.__plnngpkr_rooms) {
  globalStore.__plnngpkr_rooms = new Map<string, ActiveRoom>();
}

// Use the global store for room state
const activeRooms = globalStore.__plnngpkr_rooms;

export function createRoom(roomData: Omit<Room, "createdAt">): Room {
  const room: Room = {
    ...roomData,
    createdAt: new Date(),
  };

  const activeRoom: ActiveRoom = {
    room,
    participants: new Map(),
    stories: [],
    currentStoryId: null,
    votingRound: null,
    chatMessages: [],
    timer: null,
  };

  activeRooms.set(room.id, activeRoom);
  return room;
}

export function getRoom(roomId: string): ActiveRoom | undefined {
  console.log(`[rooms] getRoom(${roomId}), total rooms: ${activeRooms.size}, exists: ${activeRooms.has(roomId)}`);
  return activeRooms.get(roomId);
}

// Ensure there's always a moderator among connected non-spectators
function ensureModerator(activeRoom: ActiveRoom): void {
  const connectedVoters = Array.from(activeRoom.participants.values()).filter(
    (p) => !p.isSpectator && p.connectionStatus === "connected"
  );

  if (connectedVoters.length === 0) return;

  const hasModerator = connectedVoters.some((p) => p.isModerator);

  if (!hasModerator) {
    // Assign first connected voter as moderator
    connectedVoters[0].isModerator = true;
    activeRoom.participants.set(connectedVoters[0].id, connectedVoters[0]);
  }
}

export function getRoomState(roomId: string): RoomState | null {
  console.log(`[rooms] getRoomState(${roomId}), total rooms: ${activeRooms.size}, exists: ${activeRooms.has(roomId)}`);
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  // Ensure there's a moderator before returning state
  ensureModerator(activeRoom);

  return {
    room: activeRoom.room,
    participants: Array.from(activeRoom.participants.values()),
    stories: activeRoom.stories,
    currentStoryId: activeRoom.currentStoryId,
    votingRound: activeRoom.votingRound,
    chatMessages: activeRoom.chatMessages.slice(-100), // Last 100 messages
    timer: activeRoom.timer,
  };
}

export function addParticipant(
  roomId: string,
  participant: Participant
): Participant | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  activeRoom.participants.set(participant.id, participant);

  // Ensure there's always a moderator among non-spectators
  if (!participant.isSpectator) {
    const voters = Array.from(activeRoom.participants.values()).filter(
      (p) => !p.isSpectator
    );
    const hasModerator = voters.some((p) => p.isModerator);

    // If no moderator exists, make this participant the moderator
    if (!hasModerator) {
      participant.isModerator = true;
      activeRoom.participants.set(participant.id, participant);
    }
  }

  return participant;
}

export function removeParticipant(
  roomId: string,
  participantId: string
): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const participant = activeRoom.participants.get(participantId);
  if (!participant) return false;

  activeRoom.participants.delete(participantId);

  // If moderator left, assign new moderator
  if (participant.isModerator) {
    const voters = Array.from(activeRoom.participants.values()).filter(
      (p) => !p.isSpectator
    );
    if (voters.length > 0) {
      voters[0].isModerator = true;
      activeRoom.participants.set(voters[0].id, voters[0]);
    }
  }

  // Clean up room if empty
  if (activeRoom.participants.size === 0) {
    if (activeRoom.timerInterval) {
      clearInterval(activeRoom.timerInterval);
    }
    activeRooms.delete(roomId);
  }

  return true;
}

export function updateParticipantConnection(
  roomId: string,
  participantId: string,
  status: "connected" | "disconnected" | "reconnecting"
): Participant | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const participant = activeRoom.participants.get(participantId);
  if (!participant) return null;

  participant.connectionStatus = status;
  activeRoom.participants.set(participantId, participant);

  // When someone reconnects, ensure there's a moderator
  if (status === "connected") {
    ensureModerator(activeRoom);
  }

  return participant;
}

export function submitVote(
  roomId: string,
  participantId: string,
  storyId: string,
  value: CardValue
): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || !activeRoom.votingRound) return false;

  if (activeRoom.votingRound.storyId !== storyId) return false;
  if (activeRoom.votingRound.status === "revealed") return false;

  const participant = activeRoom.participants.get(participantId);
  if (!participant || participant.isSpectator) return false;

  // Check if revoting is allowed
  if (
    participant.hasVoted &&
    !activeRoom.room.settings.allowRevote
  ) {
    return false;
  }

  // Record vote
  const vote: Vote = {
    participantId,
    participantName: participant.name,
    storyId,
    value,
    timestamp: new Date(),
  };

  activeRoom.votingRound.votes[participantId] = vote;
  participant.hasVoted = true;
  activeRoom.participants.set(participantId, participant);

  return true;
}

export function clearVote(roomId: string, participantId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || !activeRoom.votingRound) return false;

  if (activeRoom.votingRound.status === "revealed") return false;

  const participant = activeRoom.participants.get(participantId);
  if (!participant) return false;

  delete activeRoom.votingRound.votes[participantId];
  participant.hasVoted = false;
  participant.currentVote = undefined;
  activeRoom.participants.set(participantId, participant);

  return true;
}

export function revealVotes(roomId: string) {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || !activeRoom.votingRound) return null;

  activeRoom.votingRound.status = "revealed";
  activeRoom.votingRound.revealedAt = new Date();

  const votes = Object.values(activeRoom.votingRound.votes);

  // Update participants with their votes
  for (const vote of votes) {
    const participant = activeRoom.participants.get(vote.participantId);
    if (participant) {
      participant.currentVote = vote.value;
      activeRoom.participants.set(vote.participantId, participant);
    }
  }

  const stats = calculateVotingStats(activeRoom.votingRound.storyId, votes);

  // Update story status and cache votes/stats
  const story = activeRoom.stories.find(
    (s) => s.id === activeRoom.votingRound?.storyId
  );
  if (story) {
    story.status = "revealed";
    story.estimatedAt = new Date();
    story.cachedVotes = votes;
    story.cachedStats = stats;
  }

  return { votes, stats };
}

export function resetVotes(roomId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || !activeRoom.votingRound) return false;

  activeRoom.votingRound.status = "voting";
  activeRoom.votingRound.votes = {};
  activeRoom.votingRound.revealedAt = undefined;
  activeRoom.votingRound.startedAt = new Date();

  // Reset participant vote status
  for (const participant of activeRoom.participants.values()) {
    participant.hasVoted = false;
    participant.currentVote = undefined;
  }

  return true;
}

export function setCurrentStory(
  roomId: string,
  storyId: string | null
): { success: boolean; cachedVotes?: Vote[]; cachedStats?: VotingStats } {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return { success: false };

  activeRoom.currentStoryId = storyId;

  if (storyId) {
    const story = activeRoom.stories.find((s) => s.id === storyId);

    // If story was previously revealed and has cached results, restore them
    if (story && story.status === "revealed" && story.cachedVotes && story.cachedStats) {
      // Restore the revealed state with cached votes
      activeRoom.votingRound = {
        storyId,
        status: "revealed",
        votes: story.cachedVotes.reduce((acc, vote) => {
          acc[vote.participantId] = vote;
          return acc;
        }, {} as Record<string, Vote>),
        startedAt: story.createdAt,
        revealedAt: story.estimatedAt,
      };

      // Update participants with their cached votes
      for (const vote of story.cachedVotes) {
        const participant = activeRoom.participants.get(vote.participantId);
        if (participant) {
          participant.hasVoted = true;
          participant.currentVote = vote.value;
        }
      }

      return { success: true, cachedVotes: story.cachedVotes, cachedStats: story.cachedStats };
    }

    // Start new voting round for pending/skipped stories
    activeRoom.votingRound = {
      storyId,
      status: "voting",
      votes: {},
      startedAt: new Date(),
    };

    // Update story status
    if (story) {
      story.status = "voting";
    }

    // Reset participant votes
    for (const participant of activeRoom.participants.values()) {
      participant.hasVoted = false;
      participant.currentVote = undefined;
    }
  } else {
    activeRoom.votingRound = null;
  }

  return { success: true };
}

export function addStory(
  roomId: string,
  storyData: Omit<Story, "id" | "roomId" | "createdAt">
): Story | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const story: Story = {
    ...storyData,
    id: nanoid(),
    roomId,
    createdAt: new Date(),
  };

  activeRoom.stories.push(story);
  return story;
}

export function updateStory(
  roomId: string,
  storyId: string,
  updates: Partial<Story>
): Story | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const storyIndex = activeRoom.stories.findIndex((s) => s.id === storyId);
  if (storyIndex === -1) return null;

  activeRoom.stories[storyIndex] = {
    ...activeRoom.stories[storyIndex],
    ...updates,
  };

  return activeRoom.stories[storyIndex];
}

export function deleteStory(roomId: string, storyId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const storyIndex = activeRoom.stories.findIndex((s) => s.id === storyId);
  if (storyIndex === -1) return false;

  activeRoom.stories.splice(storyIndex, 1);

  // If deleted story was current, clear current
  if (activeRoom.currentStoryId === storyId) {
    activeRoom.currentStoryId = null;
    activeRoom.votingRound = null;
  }

  return true;
}

export function reorderStories(roomId: string, storyIds: string[]): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const reorderedStories: Story[] = [];
  for (let i = 0; i < storyIds.length; i++) {
    const story = activeRoom.stories.find((s) => s.id === storyIds[i]);
    if (story) {
      story.order = i;
      reorderedStories.push(story);
    }
  }

  activeRoom.stories = reorderedStories;
  return true;
}

export function setFinalEstimate(
  roomId: string,
  storyId: string,
  value: CardValue
): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const story = activeRoom.stories.find((s) => s.id === storyId);
  if (!story) return false;

  story.finalEstimate = value;
  return true;
}

export function addChatMessage(
  roomId: string,
  participantId: string,
  content: string
): ChatMessage | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const participant = activeRoom.participants.get(participantId);
  if (!participant) return null;

  const message: ChatMessage = {
    id: nanoid(),
    participantId,
    participantName: participant.name,
    content,
    timestamp: new Date(),
    type: "message",
  };

  activeRoom.chatMessages.push(message);

  // Keep only last 500 messages
  if (activeRoom.chatMessages.length > 500) {
    activeRoom.chatMessages = activeRoom.chatMessages.slice(-500);
  }

  return message;
}

export function addSystemMessage(
  roomId: string,
  content: string
): ChatMessage | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const message: ChatMessage = {
    id: nanoid(),
    participantId: "system",
    participantName: "System",
    content,
    timestamp: new Date(),
    type: "system",
  };

  activeRoom.chatMessages.push(message);
  return message;
}

export function updateSettings(
  roomId: string,
  settings: Partial<RoomSettings>
): RoomSettings | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  activeRoom.room.settings = {
    ...activeRoom.room.settings,
    ...settings,
  };

  return activeRoom.room.settings;
}

export function checkAllVoted(roomId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const voters = Array.from(activeRoom.participants.values()).filter(
    (p) => !p.isSpectator && p.connectionStatus === "connected"
  );

  return voters.length > 0 && voters.every((p) => p.hasVoted);
}

export function promoteModerator(
  roomId: string,
  participantId: string
): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  // Remove moderator status from all
  for (const participant of activeRoom.participants.values()) {
    participant.isModerator = false;
  }

  // Set new moderator
  const newModerator = activeRoom.participants.get(participantId);
  if (!newModerator || newModerator.isSpectator) return false;

  newModerator.isModerator = true;
  activeRoom.participants.set(participantId, newModerator);

  return true;
}

export function kickParticipant(
  roomId: string,
  participantId: string
): boolean {
  return removeParticipant(roomId, participantId);
}

// Timer functions
export function startTimer(
  roomId: string,
  onTick: (remaining: number) => void,
  onExpire: () => void
): Date | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const duration = activeRoom.room.settings.timerDuration;
  const endsAt = new Date(Date.now() + duration * 1000);

  activeRoom.timer = {
    isRunning: true,
    remaining: duration,
    endsAt,
  };

  // Clear any existing interval
  if (activeRoom.timerInterval) {
    clearInterval(activeRoom.timerInterval);
  }

  activeRoom.timerInterval = setInterval(() => {
    if (!activeRoom.timer || !activeRoom.timer.isRunning) {
      clearInterval(activeRoom.timerInterval);
      return;
    }

    activeRoom.timer.remaining--;
    onTick(activeRoom.timer.remaining);

    if (activeRoom.timer.remaining <= 0) {
      clearInterval(activeRoom.timerInterval);
      activeRoom.timer.isRunning = false;
      onExpire();
    }
  }, 1000);

  return endsAt;
}

export function pauseTimer(roomId: string): number | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || !activeRoom.timer) return null;

  if (activeRoom.timerInterval) {
    clearInterval(activeRoom.timerInterval);
  }

  activeRoom.timer.isRunning = false;
  activeRoom.timer.endsAt = undefined;

  return activeRoom.timer.remaining;
}

export function resetTimer(roomId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  if (activeRoom.timerInterval) {
    clearInterval(activeRoom.timerInterval);
  }

  activeRoom.timer = null;
  return true;
}

// Export stories as CSV
export function exportStories(roomId: string): string | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const headers = ["Title", "Description", "Final Estimate", "Status"];
  const rows = activeRoom.stories.map((story) => [
    `"${story.title.replace(/"/g, '""')}"`,
    `"${(story.description || "").replace(/"/g, '""')}"`,
    story.finalEstimate ?? "",
    story.status,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

// Export stories as JSON
export function exportStoriesJson(roomId: string): object | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  return {
    roomName: activeRoom.room.name,
    exportedAt: new Date().toISOString(),
    stories: activeRoom.stories.map((story) => ({
      title: story.title,
      description: story.description,
      finalEstimate: story.finalEstimate,
      status: story.status,
    })),
  };
}
