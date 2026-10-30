import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Socket as ClientSocket } from "socket.io-client";
import * as rooms from "../rooms";
import { DEFAULT_ROOM_SETTINGS } from "../../src/lib/constants/decks";
import { closeDb } from "../../src/lib/db";
import { startTestServer, connectClient, nextEvent, type TestServer } from "./helpers/socketServer";

const ROOM_ID = "participant-key-room";
const MOD_KEY = "moderator-key-0123456789";

describe("participant keys", () => {
  let server: TestServer;
  let clients: ClientSocket[] = [];

  beforeEach(async () => {
    for (const c of clients) c.disconnect();
    clients = [];
    if (!server) server = await startTestServer();
    rooms.deleteRoom(ROOM_ID);
    rooms.createRoom({
      id: ROOM_ID,
      name: "Participant keys",
      deckType: "fibonacci",
      settings: { ...DEFAULT_ROOM_SETTINGS },
      createdBy: "tester",
    });
  });

  after(async () => {
    for (const c of clients) c.disconnect();
    await server.close();
    rooms.deleteRoom(ROOM_ID);
    await rooms.flushDbWrites();
    await closeDb();
  });

  async function join(participantId: string, key: string): Promise<ClientSocket> {
    const socket = await connectClient(server.url);
    clients.push(socket);
    socket.emit("join", { roomId: ROOM_ID, participantId, key, name: participantId, isSpectator: false });
    return socket;
  }

  it("lets the owner of an ID rejoin with its key", async () => {
    await nextEvent(await join("mod", MOD_KEY), "sync");
    const again = await join("mod", MOD_KEY);
    await nextEvent(again, "sync");
    assert.equal(rooms.isParticipantModerator(ROOM_ID, "mod"), true);
  });

  it("refuses someone who reuses the moderator's ID without the key", async () => {
    await nextEvent(await join("mod", MOD_KEY), "sync");
    const thief = await join("mod", "someone-elses-key-0123");
    const error = await nextEvent<{ code: string }>(thief, "error");
    assert.equal(error.code, "PARTICIPANT_KEY_MISMATCH");
    assert.equal(rooms.getRoom(ROOM_ID)?.participants.get("mod")?.name, "mod");
  });

  it("refuses a join with no key", async () => {
    const socket = await connectClient(server.url);
    clients.push(socket);
    socket.emit("join", { roomId: ROOM_ID, participantId: "nokey", name: "nokey", isSpectator: false });
    const error = await nextEvent<{ code: string }>(socket, "error");
    assert.equal(error.code, "INVALID_PARAMS");
  });

  it("never sends keys to clients", async () => {
    const socket = await join("mod", MOD_KEY);
    const sync = await nextEvent(socket, "sync");
    assert.equal(JSON.stringify(sync).includes(MOD_KEY), false);
  });
});
