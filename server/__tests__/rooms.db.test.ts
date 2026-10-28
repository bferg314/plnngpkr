// Runs against Postgres when DATABASE_URL is set, for example
//   createdb plnngpkr_test && DATABASE_URL=postgres:///plnngpkr_test npm test
// and skips otherwise (CI has no database).
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { inArray, eq } from "drizzle-orm";
import * as rooms from "../rooms";
import { runMigrations } from "../migrate";
import { db, closeDb, rooms as roomsTable, stories as storiesTable, voteHistory as voteHistoryTable } from "../../src/lib/db";
import { DEFAULT_ROOM_SETTINGS } from "../../src/lib/constants/decks";

const DAY = 24 * 60 * 60 * 1000;
const RETENTION = 30 * DAY;
const NOW = new Date();
const OLD = new Date(NOW.getTime() - 40 * DAY);
const RECENT = new Date(NOW.getTime() - 2 * DAY);
const IDS = ["db-old", "db-recent", "db-old-recent-vote", "db-old-recent-story", "db-old-in-memory", "db-expire"];

async function insertRoom(id: string, updatedAt: Date): Promise<void> {
  await db!.insert(roomsTable).values({
    id,
    name: id,
    deckType: "fibonacci",
    settings: DEFAULT_ROOM_SETTINGS,
    createdBy: "tester",
    createdAt: updatedAt,
    updatedAt,
  });
}

async function insertStory(id: string, roomId: string, createdAt: Date, estimatedAt?: Date): Promise<void> {
  await db!.insert(storiesTable).values({ id, roomId, title: id, order: 0, createdAt, estimatedAt });
}

async function insertVote(id: string, roomId: string, storyId: string, votedAt: Date): Promise<void> {
  await db!.insert(voteHistoryTable).values({ id, roomId, storyId, participantName: "p", value: 3, votedAt });
}

async function roomIds(): Promise<string[]> {
  const rows = await db!.select({ id: roomsTable.id }).from(roomsTable).where(inArray(roomsTable.id, IDS));
  return rows.map((r) => r.id).sort();
}

describe("database cleanup of expired rooms", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  before(async () => {
    await runMigrations();
  });

  after(async () => {
    await rooms.flushDbWrites();
    await db!.delete(roomsTable).where(inArray(roomsTable.id, IDS));
    await closeDb();
  });

  beforeEach(async () => {
    for (const id of IDS) rooms.deleteRoom(id);
    await db!.delete(roomsTable).where(inArray(roomsTable.id, IDS));
  });

  it("deletes rooms idle past retention, with their stories and votes", async () => {
    await insertRoom("db-old", OLD);
    await insertStory("db-old-s1", "db-old", OLD, OLD);
    await insertVote("db-old-v1", "db-old", "db-old-s1", OLD);
    await insertRoom("db-recent", RECENT);

    const deleted = await rooms.purgeExpiredRoomsFromDb(RETENTION, NOW);

    assert.ok(deleted >= 1);
    assert.deepEqual(await roomIds(), ["db-recent"]);
    assert.equal((await db!.select().from(storiesTable).where(eq(storiesTable.roomId, "db-old"))).length, 0);
    assert.equal((await db!.select().from(voteHistoryTable).where(eq(voteHistoryTable.roomId, "db-old"))).length, 0);
  });

  it("keeps an old room that has recent stories or votes", async () => {
    await insertRoom("db-old-recent-vote", OLD);
    await insertStory("db-orv-s1", "db-old-recent-vote", OLD, OLD);
    await insertVote("db-orv-v1", "db-old-recent-vote", "db-orv-s1", RECENT);
    await insertRoom("db-old-recent-story", OLD);
    await insertStory("db-ors-s1", "db-old-recent-story", RECENT);

    await rooms.purgeExpiredRoomsFromDb(RETENTION, NOW);

    assert.deepEqual(await roomIds(), ["db-old-recent-story", "db-old-recent-vote"]);
  });

  it("keeps rooms that are loaded in memory", async () => {
    await insertRoom("db-old-in-memory", OLD);
    assert.ok(await rooms.hydrateRoomFromDb("db-old-in-memory"));
    // hydrating bumps updated_at; backdate it so only the in-memory check protects the room
    await db!.update(roomsTable).set({ updatedAt: OLD }).where(eq(roomsTable.id, "db-old-in-memory"));

    await rooms.purgeExpiredRoomsFromDb(RETENTION, NOW);
    assert.deepEqual(await roomIds(), ["db-old-in-memory"]);

    // Once it leaves memory it is fair game
    await rooms.expireIdleRoom("db-old-in-memory");
    await db!.update(roomsTable).set({ updatedAt: OLD }).where(eq(roomsTable.id, "db-old-in-memory"));
    await rooms.purgeExpiredRoomsFromDb(RETENTION, NOW);
    assert.deepEqual(await roomIds(), []);
  });

  it("starts the retention period when an empty room leaves memory", async () => {
    await insertRoom("db-expire", OLD);
    assert.ok(await rooms.hydrateRoomFromDb("db-expire"));
    await db!.update(roomsTable).set({ updatedAt: OLD }).where(eq(roomsTable.id, "db-expire"));

    const before = Date.now();
    assert.equal(await rooms.expireIdleRoom("db-expire"), true);
    assert.equal(rooms.getRoom("db-expire"), undefined);

    const [row] = await db!.select().from(roomsTable).where(eq(roomsTable.id, "db-expire"));
    assert.ok(row.updatedAt.getTime() >= before - 1000, "updated_at was bumped on expiry");

    // Still in the database, so the link keeps working and the room is not purged yet
    await rooms.purgeExpiredRoomsFromDb(RETENTION, NOW);
    assert.deepEqual(await roomIds(), ["db-expire"]);
    assert.ok(await rooms.hydrateRoomFromDb("db-expire"));
  });

  it("does not expire a room that still has participants", async () => {
    await insertRoom("db-expire", RECENT);
    await rooms.hydrateRoomFromDb("db-expire");
    rooms.addParticipant("db-expire", {
      id: "p1",
      name: "Alice",
      isSpectator: false,
      isModerator: false,
      hasVoted: false,
      connectionStatus: "connected",
    });

    assert.equal(await rooms.expireIdleRoom("db-expire"), false);
    assert.ok(rooms.getRoom("db-expire"));
  });
});

describe("roomRetentionMs", () => {
  it("defaults to 30 days and turns off at 0", () => {
    const saved = process.env.ROOM_RETENTION_DAYS;
    try {
      delete process.env.ROOM_RETENTION_DAYS;
      assert.equal(rooms.roomRetentionMs(), 30 * DAY);
      process.env.ROOM_RETENTION_DAYS = "7";
      assert.equal(rooms.roomRetentionMs(), 7 * DAY);
      process.env.ROOM_RETENTION_DAYS = "0";
      assert.equal(rooms.roomRetentionMs(), null);
    } finally {
      if (saved === undefined) delete process.env.ROOM_RETENTION_DAYS;
      else process.env.ROOM_RETENTION_DAYS = saved;
    }
  });
});
