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
  DeckType,
} from "../src/types";
import { calculateVotingStats } from "../src/lib/utils/statistics";
import { db, rooms as roomsTable, stories as storiesTable, voteHistory as voteHistoryTable } from "../src/lib/db";
import { eq, asc, and, or, lt, gte, notExists, notInArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { timingSafeEqual } from "crypto";

// Room TTL when empty (1 hour)
const ROOM_EMPTY_TTL_MS = 60 * 60 * 1000;

// How long a room stays in the database after its last activity (default 30 days)
const DEFAULT_ROOM_RETENTION_DAYS = 30;
const DB_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// In-memory store for active room states
// Using globalThis to ensure singleton across module reloads in development
const globalStore = globalThis as typeof globalThis & {
  __plnngpkr_rooms?: Map<string, ActiveRoom>;
};

export interface ActiveRoom {
  room: Room;
  participants: Map<string, Participant>;
  // Rejoin key per participant ID. Kept out of Participant so it is never sent to clients.
  participantKeys: Map<string, string>;
  stories: Story[];
  currentStoryId: string | null;
  votingRound: VotingRound | null;
  chatMessages: ChatMessage[];
  timer: TimerState | null;
  timerInterval?: NodeJS.Timeout;
  cleanupTimeout?: NodeJS.Timeout;
}

// Initialize the global store if it doesn't exist
if (!globalStore.__plnngpkr_rooms) {
  globalStore.__plnngpkr_rooms = new Map<string, ActiveRoom>();
}

// Use the global store for room state
const activeRooms = globalStore.__plnngpkr_rooms;

// --- Database Persistence Helpers (Non-blocking with graceful fallback) ---

// Writes run in the background; keep hold of them so tests can wait them out.
const pendingWrites = new Set<Promise<void>>();

function trackWrite(write: Promise<void>): void {
  pendingWrites.add(write);
  void write.finally(() => pendingWrites.delete(write));
}

export async function flushDbWrites(): Promise<void> {
  while (pendingWrites.size > 0) {
    await Promise.all(pendingWrites);
  }
}

async function persistRoomToDb(room: Room): Promise<void> {
  if (!db) return;
  try {
    await db
      .insert(roomsTable)
      .values({
        id: room.id,
        name: room.name,
        deckType: room.deckType,
        customDeck: room.customDeck ?? null,
        settings: room.settings,
        status: "active",
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: roomsTable.id,
        set: {
          name: room.name,
          deckType: room.deckType,
          customDeck: room.customDeck ?? null,
          settings: room.settings,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn("[rooms] Failed to persist room to database:", err);
  }
}

async function persistStoryToDb(story: Story): Promise<void> {
  if (!db) return;
  try {
    await db
      .insert(storiesTable)
      .values({
        id: story.id,
        roomId: story.roomId,
        title: story.title,
        description: story.description ?? null,
        order: story.order,
        status: story.status,
        finalEstimate: story.finalEstimate ?? null,
        cachedVotes: story.cachedVotes ?? null,
        cachedStats: story.cachedStats ?? null,
        createdAt: story.createdAt,
        estimatedAt: story.estimatedAt ?? null,
      })
      .onConflictDoUpdate({
        target: storiesTable.id,
        set: {
          title: story.title,
          description: story.description ?? null,
          order: story.order,
          status: story.status,
          finalEstimate: story.finalEstimate ?? null,
          cachedVotes: story.cachedVotes ?? null,
          cachedStats: story.cachedStats ?? null,
          estimatedAt: story.estimatedAt ?? null,
        },
      });
  } catch (err) {
    console.warn("[rooms] Failed to persist story to database:", err);
  }
}

async function deleteStoryFromDb(storyId: string): Promise<void> {
  if (!db) return;
  try {
    await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
  } catch (err) {
    console.warn("[rooms] Failed to delete story from database:", err);
  }
}

async function persistVotesToDb(roomId: string, votes: Vote[]): Promise<void> {
  if (!db || votes.length === 0) return;
  try {
    await db.insert(voteHistoryTable).values(
      votes.map((v) => ({
        id: nanoid(),
        roomId,
        storyId: v.storyId,
        participantId: v.participantId,
        participantName: v.participantName,
        value: v.value,
        votedAt: v.timestamp,
      }))
    );
  } catch (err) {
    console.warn("[rooms] Failed to persist vote history to database:", err);
  }
}

// Mark a room as recently used, so the database cleanup measures retention from now.
async function touchRoomInDb(roomId: string): Promise<void> {
  if (!db) return;
  try {
    await db.update(roomsTable).set({ updatedAt: new Date() }).where(eq(roomsTable.id, roomId));
  } catch (err) {
    console.warn("[rooms] Failed to update room activity in database:", err);
  }
}

// Delete rooms with no activity since `now - retentionMs`. Activity is the room's
// updated_at (bumped when it leaves memory), a story created or estimated, or a
// vote recorded. Rooms in memory are skipped. Stories and vote history go with
// the room through ON DELETE CASCADE. Returns the number of rooms deleted.
export async function purgeExpiredRoomsFromDb(
  retentionMs: number,
  now: Date = new Date()
): Promise<number> {
  if (!db) return 0;
  const cutoff = new Date(now.getTime() - retentionMs);
  const activeIds = Array.from(activeRooms.keys());

  const deleted = await db
    .delete(roomsTable)
    .where(
      and(
        lt(roomsTable.updatedAt, cutoff),
        activeIds.length > 0 ? notInArray(roomsTable.id, activeIds) : undefined,
        notExists(
          db
            .select({ one: sql`1` })
            .from(storiesTable)
            .where(
              and(
                eq(storiesTable.roomId, roomsTable.id),
                or(gte(storiesTable.createdAt, cutoff), gte(storiesTable.estimatedAt, cutoff))
              )
            )
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(voteHistoryTable)
            .where(
              and(eq(voteHistoryTable.roomId, roomsTable.id), gte(voteHistoryTable.votedAt, cutoff))
            )
        )
      )
    )
    .returning({ id: roomsTable.id });
  return deleted.length;
}

export function roomRetentionMs(): number | null {
  const raw = process.env.ROOM_RETENTION_DAYS;
  const days = raw === undefined || raw === "" ? DEFAULT_ROOM_RETENTION_DAYS : Number(raw);
  if (!Number.isFinite(days) || days <= 0) return null;
  return days * 24 * 60 * 60 * 1000;
}

// Run the database cleanup now and then hourly. ROOM_RETENTION_DAYS=0 turns it off.
// Returns a function that stops it.
export function startDbCleanup(): () => void {
  const retentionMs = roomRetentionMs();
  if (!db || retentionMs === null) return () => {};

  const run = async () => {
    try {
      const count = await purgeExpiredRoomsFromDb(retentionMs);
      if (count > 0) console.log(`[rooms] Deleted ${count} expired room(s) from database`);
    } catch (err) {
      console.warn("[rooms] Failed to delete expired rooms from database:", err);
    }
  };

  void run();
  const interval = setInterval(run, DB_CLEANUP_INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
}

export async function hydrateRoomFromDb(roomId: string): Promise<ActiveRoom | undefined> {
  const existing = activeRooms.get(roomId);
  if (existing) return existing;
  if (!db) return undefined;

  try {
    const [dbRoom] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, roomId))
      .limit(1);

    if (!dbRoom) return undefined;

    const dbStories = await db
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.roomId, roomId))
      .orderBy(asc(storiesTable.order));

    const room: Room = {
      id: dbRoom.id,
      name: dbRoom.name,
      deckType: dbRoom.deckType as DeckType,
      customDeck: (dbRoom.customDeck as CardValue[] | null) ?? undefined,
      settings: dbRoom.settings as RoomSettings,
      createdAt: dbRoom.createdAt,
      createdBy: dbRoom.createdBy,
    };

    const stories: Story[] = dbStories.map((s) => ({
      id: s.id,
      roomId: s.roomId,
      title: s.title,
      description: s.description ?? undefined,
      order: s.order,
      status: (s.status as Story["status"]) || "pending",
      finalEstimate: (s.finalEstimate as CardValue) ?? undefined,
      createdAt: s.createdAt,
      estimatedAt: s.estimatedAt ?? undefined,
      cachedVotes: (s.cachedVotes as Vote[] | null) ?? undefined,
      cachedStats: (s.cachedStats as VotingStats | null) ?? undefined,
    }));

    const activeRoom: ActiveRoom = {
      room,
      participants: new Map(),
      participantKeys: new Map(),
      stories,
      currentStoryId: null,
      votingRound: null,
      chatMessages: [],
      timer: null,
    };

    scheduleRoomCleanup(roomId, activeRoom);
    activeRooms.set(roomId, activeRoom);
    await touchRoomInDb(roomId);
    return activeRoom;
  } catch (err) {
    console.warn("[rooms] Failed to hydrate room from database:", err);
    return undefined;
  }
}

function scheduleRoomCleanup(roomId: string, activeRoom: ActiveRoom, ttlMs = ROOM_EMPTY_TTL_MS): void {
  if (activeRoom.cleanupTimeout) {
    clearTimeout(activeRoom.cleanupTimeout);
  }
  activeRoom.cleanupTimeout = setTimeout(() => {
    void expireIdleRoom(roomId);
  }, ttlMs);
  if (typeof activeRoom.cleanupTimeout.unref === "function") {
    activeRoom.cleanupTimeout.unref();
  }
}

// Drop an empty room from memory once its TTL passes. The database copy stays, so
// the link keeps working, and its updated_at starts the retention period.
export async function expireIdleRoom(roomId: string): Promise<boolean> {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || activeRoom.participants.size > 0) return false;
  if (activeRoom.timerInterval) {
    clearInterval(activeRoom.timerInterval);
  }
  if (activeRoom.cleanupTimeout) {
    clearTimeout(activeRoom.cleanupTimeout);
  }
  activeRooms.delete(roomId);
  await touchRoomInDb(roomId);
  return true;
}

export function createRoom(roomData: Omit<Room, "createdAt">): Room {
  const room: Room = {
    ...roomData,
    createdAt: new Date(),
  };

  const activeRoom: ActiveRoom = {
    room,
    participants: new Map(),
    participantKeys: new Map(),
    stories: [],
    currentStoryId: null,
    votingRound: null,
    chatMessages: [],
    timer: null,
  };

  scheduleRoomCleanup(room.id, activeRoom);
  activeRooms.set(room.id, activeRoom);
  trackWrite(persistRoomToDb(room));
  return room;
}

export function deleteRoom(roomId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;
  if (activeRoom.timerInterval) {
    clearInterval(activeRoom.timerInterval);
  }
  if (activeRoom.cleanupTimeout) {
    clearTimeout(activeRoom.cleanupTimeout);
  }
  return activeRooms.delete(roomId);
}

export function getRoom(roomId: string): ActiveRoom | undefined {
  return activeRooms.get(roomId);
}

export function isParticipantModerator(roomId: string, participantId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;
  const participant = activeRoom.participants.get(participantId);
  return Boolean(participant?.isModerator);
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

export function getRoomState(roomId: string, viewerParticipantId?: string): RoomState | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  // Ensure there's a moderator before returning state
  ensureModerator(activeRoom);

  const isRevealed = activeRoom.votingRound?.status === "revealed";

  // Redact unrevealed votes from participants list unless it belongs to the viewer
  const sanitizedParticipants: Participant[] = Array.from(
    activeRoom.participants.values()
  ).map((p) => ({
    ...p,
    currentVote:
      isRevealed || (viewerParticipantId && p.id === viewerParticipantId)
        ? p.currentVote
        : undefined,
  }));

  // Redact unrevealed vote values from votingRound
  let sanitizedVotingRound: VotingRound | null = null;
  let votingStats: VotingStats | null = null;

  if (activeRoom.votingRound) {
    if (isRevealed) {
      sanitizedVotingRound = activeRoom.votingRound;
      const currentStory = activeRoom.stories.find(
        (s) => s.id === activeRoom.votingRound?.storyId
      );
      votingStats =
        currentStory?.cachedStats ??
        calculateVotingStats(
          activeRoom.votingRound.storyId,
          Object.values(activeRoom.votingRound.votes)
        );
    } else {
      const redactedVotes: Record<string, Vote> = {};
      for (const [pid, vote] of Object.entries(activeRoom.votingRound.votes)) {
        redactedVotes[pid] = {
          ...vote,
          value: viewerParticipantId && pid === viewerParticipantId ? vote.value : null,
        };
      }
      sanitizedVotingRound = {
        ...activeRoom.votingRound,
        votes: redactedVotes,
      };
    }
  }

  return {
    room: activeRoom.room,
    participants: sanitizedParticipants,
    stories: activeRoom.stories,
    currentStoryId: activeRoom.currentStoryId,
    votingRound: sanitizedVotingRound,
    votingStats,
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

  if (activeRoom.cleanupTimeout) {
    clearTimeout(activeRoom.cleanupTimeout);
    activeRoom.cleanupTimeout = undefined;
  }

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

// Participant IDs are visible to everyone in the room, so rejoining under an
// existing ID needs the key that was sent when the ID was first used.
export function claimParticipantKey(
  roomId: string,
  participantId: string,
  key: string
): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const stored = activeRoom.participantKeys.get(participantId);
  if (stored === undefined) {
    activeRoom.participantKeys.set(participantId, key);
    return true;
  }
  const a = Buffer.from(stored);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
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
  activeRoom.participantKeys.delete(participantId);

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

  // Schedule cleanup if room becomes empty (preserve state for TTL grace period)
  if (activeRoom.participants.size === 0) {
    if (activeRoom.timerInterval) {
      clearInterval(activeRoom.timerInterval);
      activeRoom.timerInterval = undefined;
    }
    scheduleRoomCleanup(roomId, activeRoom);
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
  participant.currentVote = value;
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
  for (const participant of activeRoom.participants.values()) {
    const vote = activeRoom.votingRound.votes[participant.id];
    participant.currentVote = vote ? vote.value : undefined;
    activeRoom.participants.set(participant.id, participant);
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
    trackWrite(persistStoryToDb(story));
  }

  trackWrite(persistVotesToDb(roomId, votes));

  return { votes, stats };
}

export function resetVotes(roomId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom || !activeRoom.votingRound) return false;

  activeRoom.votingRound.status = "voting";
  activeRoom.votingRound.votes = {};
  activeRoom.votingRound.revealedAt = undefined;
  activeRoom.votingRound.startedAt = new Date();

  const story = activeRoom.stories.find(
    (s) => s.id === activeRoom.votingRound?.storyId
  );
  if (story) {
    story.status = "voting";
    story.cachedVotes = undefined;
    story.cachedStats = undefined;
    trackWrite(persistStoryToDb(story));
  }

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

  // Always reset all participants' vote state first when switching stories
  for (const participant of activeRoom.participants.values()) {
    participant.hasVoted = false;
    participant.currentVote = undefined;
  }

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
      trackWrite(persistStoryToDb(story));
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

  const title = storyData.title?.trim();
  if (!title) return null;

  const story: Story = {
    ...storyData,
    title,
    description: storyData.description?.trim() || undefined,
    id: nanoid(),
    roomId,
    createdAt: new Date(),
  };

  activeRoom.stories.push(story);
  trackWrite(persistStoryToDb(story));
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

  const sanitizedUpdates: Partial<Story> = {};
  if (typeof updates.title === "string" && updates.title.trim()) {
    sanitizedUpdates.title = updates.title.trim();
  }
  if (updates.description !== undefined) {
    sanitizedUpdates.description = updates.description?.trim() || undefined;
  }
  if (updates.status !== undefined) {
    sanitizedUpdates.status = updates.status;
  }
  if (updates.finalEstimate !== undefined) {
    sanitizedUpdates.finalEstimate = updates.finalEstimate;
  }

  activeRoom.stories[storyIndex] = {
    ...activeRoom.stories[storyIndex],
    ...sanitizedUpdates,
  };

  trackWrite(persistStoryToDb(activeRoom.stories[storyIndex]));
  return activeRoom.stories[storyIndex];
}

export function deleteStory(roomId: string, storyId: string): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const storyIndex = activeRoom.stories.findIndex((s) => s.id === storyId);
  if (storyIndex === -1) return false;

  activeRoom.stories.splice(storyIndex, 1);

  // Re-normalize story orders
  activeRoom.stories.forEach((s, idx) => {
    s.order = idx;
    trackWrite(persistStoryToDb(s));
  });

  // If deleted story was current, clear current
  if (activeRoom.currentStoryId === storyId) {
    activeRoom.currentStoryId = null;
    activeRoom.votingRound = null;
    for (const participant of activeRoom.participants.values()) {
      participant.hasVoted = false;
      participant.currentVote = undefined;
    }
  }

  trackWrite(deleteStoryFromDb(storyId));
  return true;
}

export function reorderStories(roomId: string, storyIds: string[]): boolean {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return false;

  const reorderedStories: Story[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < storyIds.length; i++) {
    const story = activeRoom.stories.find((s) => s.id === storyIds[i]);
    if (story && !seen.has(story.id)) {
      seen.add(story.id);
      story.order = reorderedStories.length;
      reorderedStories.push(story);
      trackWrite(persistStoryToDb(story));
    }
  }

  // Append any stories that weren't in storyIds so none are accidentally lost
  for (const story of activeRoom.stories) {
    if (!seen.has(story.id)) {
      story.order = reorderedStories.length;
      reorderedStories.push(story);
      trackWrite(persistStoryToDb(story));
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
  trackWrite(persistStoryToDb(story));
  return true;
}

export function addChatMessage(
  roomId: string,
  participantId: string,
  content: string
): ChatMessage | null {
  const activeRoom = activeRooms.get(roomId);
  if (!activeRoom) return null;

  const trimmed = content?.trim();
  if (!trimmed) return null;

  const participant = activeRoom.participants.get(participantId);
  if (!participant) return null;

  const message: ChatMessage = {
    id: nanoid(),
    participantId,
    participantName: participant.name,
    content: trimmed.slice(0, 1000),
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

  trackWrite(persistRoomToDb(activeRoom.room));
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

  const newModerator = activeRoom.participants.get(participantId);
  if (!newModerator || newModerator.isSpectator) return false;

  // Remove moderator status from all
  for (const participant of activeRoom.participants.values()) {
    participant.isModerator = false;
  }

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

  // Resume from paused remaining time if paused, otherwise use room timerDuration
  const duration =
    activeRoom.timer && !activeRoom.timer.isRunning && activeRoom.timer.remaining > 0
      ? activeRoom.timer.remaining
      : activeRoom.room.settings.timerDuration;
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
