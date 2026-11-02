import { it } from "node:test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { DEFAULT_ROOM_SETTINGS } from "../../src/lib/constants/decks";
import type { RoomState } from "../../src/types";

it("hydrates a persisted room and its stories on a socket join cache miss", async () => {
  // tsx runs these tests as CommonJS in separate processes. Replace only the DB
  // boundary before loading rooms/socket: the real hydration and join code run.
  // This keeps hydration coverage mandatory even on CI without Postgres.
  const load = createRequire(__filename);
  const dbPath = load.resolve("../../src/lib/db");
  const original = load(dbPath);
  const cached = load.cache[dbPath]!;
  const selected: unknown[] = [];
  let touches = 0;
  const persistedRoom = {
    id: "socket-persisted", name: "Persisted room", deckType: "fibonacci",
    settings: { ...DEFAULT_ROOM_SETTINGS, autoReveal: false },
    createdBy: "creator", createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const persistedStory = {
    id: "persisted-story", roomId: persistedRoom.id, title: "Saved story",
    order: 0, status: "pending", createdAt: persistedRoom.createdAt,
  };
  cached.exports = {
    ...original,
    db: {
      select: () => ({ from: (table: unknown) => {
        selected.push(table);
        return { where: () => ({
          limit: async () => [persistedRoom],
          orderBy: async () => [persistedStory],
        }) };
      } }),
      update: () => ({ set: () => ({ where: async () => { touches++; } }) }),
    },
  };
  const rooms: typeof import("../rooms") = load("../rooms");
  const { startTestServer, connectClient, nextEvent }: typeof import("./helpers/socketServer") = load("./helpers/socketServer");
  const server = await startTestServer();
  const socket = await connectClient(server.url);
  try {
    assert.equal(rooms.getRoom(persistedRoom.id), undefined);
    const sync = nextEvent<{ state: RoomState }>(socket, "sync");
    socket.emit("join", { roomId: persistedRoom.id, participantId: "returning",
      key: "persisted-participant-key", name: "Returning", isSpectator: false });
    const { state } = await sync;
    assert.deepEqual(selected, [original.rooms, original.stories]);
    assert.equal(touches, 1);
    assert.equal(state.room.name, persistedRoom.name);
    assert.deepEqual(state.room.settings, persistedRoom.settings);
    assert.equal(state.stories[0].id, persistedStory.id);
    assert.equal(state.stories[0].title, persistedStory.title);
    assert.equal(state.participants[0].id, "returning");
    assert.equal(state.participants[0].isModerator, true);
    assert.ok(rooms.getRoom(persistedRoom.id));
  } finally {
    socket.disconnect();
    await server.close();
    rooms.deleteRoom(persistedRoom.id);
    cached.exports = original;
    await original.closeDb();
  }
});
