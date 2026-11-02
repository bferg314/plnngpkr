import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Socket } from "socket.io-client";
import type { RoomState, Participant, Vote } from "../../src/types";
import * as rooms from "../rooms";
import { DEFAULT_ROOM_SETTINGS } from "../../src/lib/constants/decks";
import { closeDb } from "../../src/lib/db";
import { after } from "node:test";
import { startTestServer, connectClient, nextEvent, type TestServer } from "./helpers/socketServer";

const ROOM = "socket-integration";
const key = (id: string) => `socket-test-secret-${id}`;

describe("Socket.IO room integration", () => {
  let server: TestServer;
  let clients: Socket[];
  let mod: Socket;
  let member: Socket;
  let storyId: string;

  async function join(id: string, isSpectator = false) {
    const socket = await connectClient(server.url);
    clients.push(socket);
    const sync = nextEvent<{ state: RoomState }>(socket, "sync");
    socket.emit("join", { roomId: ROOM, participantId: id, key: key(id), name: id, isSpectator });
    return { socket, state: (await sync).state };
  }

  async function emitAndWait<T = unknown>(socket: Socket, event: string, response: string, data?: unknown) {
    const received = nextEvent<T>(socket, response);
    socket.emit(event, data);
    return received;
  }

  // Socket.IO preserves packet order. A chat response fences preceding synchronous
  // handlers on this socket, including handlers that silently reject an action.
  async function fence(socket: Socket) {
    await emitAndWait(socket, "chat", "chatMessage", { content: "processed" });
  }

  beforeEach(async () => {
    clients = [];
    server = await startTestServer();
    rooms.createRoom({ id: ROOM, name: "Integration", deckType: "fibonacci",
      settings: { ...DEFAULT_ROOM_SETTINGS, autoReveal: false }, createdBy: "mod" });
    mod = (await join("mod")).socket;
    member = (await join("member")).socket;
    const result = await emitAndWait<{ stories: { id: string }[] }>(mod, "addStory", "storiesUpdated", {
      story: { title: "Estimate me", order: 0, status: "pending" },
    });
    storyId = result.stories[0].id;
    await emitAndWait(mod, "nextStory", "sync", { storyId });
    await emitAndWait(member, "vote", "voteReceived", { storyId, value: 8 });
  });

  afterEach(async () => {
    for (const socket of clients) socket.disconnect();
    await server.close();
    rooms.deleteRoom(ROOM);
    await rooms.flushDbWrites();
  });
  after(closeDb);

  it("redacts votes in broadcasts and personalized sync until moderator reveal", async () => {
    const { state } = await join("observer", true);
    assert.equal(state.participants.find(p => p.id === "member")?.currentVote, undefined);
    assert.equal(state.votingRound?.votes.member.value, null);
    const own = (await join("member")).state;
    assert.equal(own.participants.find(p => p.id === "member")?.currentVote, 8);
    assert.equal(own.votingRound?.votes.member.value, 8);

    const disconnected = nextEvent<{ participant: Participant }>(mod, "participantUpdated");
    clients.at(-1)!.disconnect();
    assert.equal((await disconnected).participant.currentVote, undefined);
    const reconnected = nextEvent<{ participant: Participant }>(mod, "participantUpdated");
    await join("member");
    assert.equal((await reconnected).participant.currentVote, undefined);

    const revealed = nextEvent<{ votes: Vote[] }>(member, "votesRevealed");
    mod.emit("reveal");
    assert.equal((await revealed).votes.find(v => v.participantId === "member")?.value, 8);
    const revealedState = (await join("late-observer", true)).state;
    assert.equal(revealedState.participants.find(p => p.id === "member")?.currentVote, 8);
    assert.equal(revealedState.votingRound?.votes.member.value, 8);
  });

  for (const event of ["reveal", "resetVotes", "promoteModerator", "kickParticipant", "updateSettings", "startTimer", "pauseTimer", "resetTimer", "nextStory", "setFinalEstimate"]) {
    it(`rejects non-moderator ${event} without state changes or broadcasts`, async () => {
      // Give pause/reset a real running timer to act on.
      await emitAndWait(mod, "startTimer", "timerStarted");
      // Stop clock ticks so the assertion measures only the attempted action.
      clearInterval(rooms.getRoom(ROOM)!.timerInterval);
      const before = JSON.stringify(rooms.getRoomState(ROOM));
      const received: string[] = [];
      const record = (name: string) => received.push(name);
      mod.onAny(record);
      member.emit(event, { participantId: event === "promoteModerator" ? "member" : "mod", settings: { autoReveal: true }, storyId: null, value: 13 });
      const processed = nextEvent(mod, "chatMessage");
      await fence(member);
      await processed;
      mod.offAny(record);
      assert.equal(JSON.stringify(rooms.getRoomState(ROOM)), JSON.stringify({
        ...JSON.parse(before), chatMessages: rooms.getRoomState(ROOM)!.chatMessages,
      }));
      assert.ok(received.every(name => name === "chatMessage"), `Unexpected broadcasts: ${received}`);
      assert.equal(rooms.isParticipantModerator(ROOM, "member"), false);
    });
  }

  it("preserves a promoted moderator's identity, vote and role across disconnect/rejoin", async () => {
    await emitAndWait(mod, "promoteModerator", "sync", { participantId: "member" });
    const disconnected = nextEvent<{ participant: Participant }>(mod, "participantUpdated");
    member.disconnect();
    assert.equal((await disconnected).participant.connectionStatus, "disconnected");
    const { socket, state } = await join("member", true);
    const participant = state.participants.find(p => p.id === "member")!;
    assert.equal(state.participants.filter(p => p.id === "member").length, 1);
    assert.equal(participant.isModerator, true);
    assert.equal(participant.isSpectator, false);
    assert.equal(participant.connectionStatus, "connected");
    assert.equal(participant.currentVote, 8);
    await emitAndWait(socket, "reveal", "votesRevealed");
  });

  it("returns ROOM_NOT_FOUND when hydration cannot find the room", async () => {
    const socket = await connectClient(server.url);
    clients.push(socket);
    const error = nextEvent<{ code: string }>(socket, "error");
    socket.emit("join", { roomId: "missing-socket-room", participantId: "missing", key: key("missing"), name: "Missing" });
    assert.equal((await error).code, "ROOM_NOT_FOUND");
  });
});
