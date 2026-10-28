import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Socket as ClientSocket } from "socket.io-client";
import * as rooms from "../rooms";
import { RateLimiter, LIMITS, clientIp, eventGroup, resetRoomCreateLimiter } from "../rateLimit";
import { DEFAULT_ROOM_SETTINGS } from "../../src/lib/constants/decks";
import { closeDb } from "../../src/lib/db";
import { startTestServer, connectClient, nextEvent, collect, wait, type TestServer } from "./helpers/socketServer";

describe("RateLimiter", () => {
  it("allows a burst, then refills at the sustained rate", () => {
    let now = 0;
    const limiter = new RateLimiter({ burst: 3, perMinute: 60 }, () => now);

    for (let i = 0; i < 3; i++) assert.equal(limiter.take("a").allowed, true);
    const blocked = limiter.take("a");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 1000);

    now += 1000;
    assert.equal(limiter.take("a").allowed, true);
    assert.equal(limiter.take("a").allowed, false);
  });

  it("keeps separate buckets per key", () => {
    const limiter = new RateLimiter({ burst: 1, perMinute: 1 }, () => 0);
    assert.equal(limiter.take("a").allowed, true);
    assert.equal(limiter.take("a").allowed, false);
    assert.equal(limiter.take("b").allowed, true);
  });

  it("prunes buckets that have refilled", () => {
    let now = 0;
    const limiter = new RateLimiter({ burst: 2, perMinute: 60 }, () => now);
    limiter.take("a");
    now += 1000;
    limiter.take("b");
    now += 1000;
    limiter.prune();
    assert.equal(limiter.size, 1);
  });
});

describe("clientIp", () => {
  it("trusts the last X-Forwarded-For entry, which the proxy appended", () => {
    assert.equal(clientIp("10.0.0.1", { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), "203.0.113.9");
  });

  it("falls back to the socket address", () => {
    assert.equal(clientIp("10.0.0.1", {}), "10.0.0.1");
  });

  it("ignores the header when TRUST_PROXY=false", () => {
    process.env.TRUST_PROXY = "false";
    try {
      assert.equal(clientIp("10.0.0.1", { "x-forwarded-for": "203.0.113.9" }), "10.0.0.1");
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });
});

describe("eventGroup", () => {
  it("shares one bucket between vote and clearVote", () => {
    assert.equal(eventGroup("vote"), "vote");
    assert.equal(eventGroup("clearVote"), "vote");
    assert.equal(eventGroup("chat"), "chat");
    assert.equal(eventGroup("addStory"), "default");
  });
});

const ROOM_ID = "rate-limit-room";

async function joinRoom(socket: ClientSocket, participantId: string): Promise<void> {
  const synced = nextEvent(socket, "sync");
  socket.emit("join", { roomId: ROOM_ID, participantId, name: participantId, isSpectator: false });
  await synced;
}

describe("socket rate limits", () => {
  let server: TestServer;
  let clients: ClientSocket[] = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
    rooms.deleteRoom(ROOM_ID);
    await rooms.flushDbWrites();
    await closeDb();
  });

  beforeEach(() => {
    for (const c of clients) c.disconnect();
    clients = [];
    rooms.deleteRoom(ROOM_ID);
    rooms.createRoom({
      id: ROOM_ID,
      name: "Rate limits",
      deckType: "fibonacci",
      settings: { ...DEFAULT_ROOM_SETTINGS },
      createdBy: "tester",
    });
  });

  async function client(): Promise<ClientSocket> {
    const socket = await connectClient(server.url);
    clients.push(socket);
    return socket;
  }

  it("drops chat over the burst and tells the sender once", async () => {
    const sender = await client();
    await joinRoom(sender, "spammer");
    const watcher = await client();
    await joinRoom(watcher, "watcher");

    const received = collect<{ message: { type: string } }>(watcher, "chatMessage");
    const notices = collect<{ event: string; retryAfterMs: number }>(sender, "rateLimited");
    for (let i = 0; i < LIMITS.chat.burst + 10; i++) sender.emit("chat", { content: `spam ${i}` });
    await wait(300);

    const userMessages = received.items.filter((m) => m.message.type === "message");
    assert.equal(userMessages.length, LIMITS.chat.burst);
    assert.equal(notices.items.length, 1);
    assert.equal(notices.items[0].event, "chat");
    assert.ok(notices.items[0].retryAfterMs > 0);
  });

  it("lets normal chat through", async () => {
    const sender = await client();
    await joinRoom(sender, "talker");
    const notices = collect(sender, "rateLimited");
    const received = collect<{ message: { type: string } }>(sender, "chatMessage");

    for (let i = 0; i < 5; i++) sender.emit("chat", { content: `hello ${i}` });
    await wait(200);

    assert.equal(received.items.filter((m) => m.message.type === "message").length, 5);
    assert.equal(notices.items.length, 0);
  });

  it("throttles vote spam without touching other events", async () => {
    const voter = await client();
    await joinRoom(voter, "voter");
    const story = rooms.addStory(ROOM_ID, { title: "Story", order: 0, status: "pending" });
    rooms.setCurrentStory(ROOM_ID, story!.id);

    const notices = collect<{ event: string }>(voter, "rateLimited");
    const received = collect(voter, "voteReceived");
    for (let i = 0; i < LIMITS.vote.burst + 20; i++) voter.emit("vote", { storyId: story!.id, value: 3 });
    await wait(300);

    assert.equal(received.items.length, LIMITS.vote.burst);
    assert.deepEqual(notices.items.map((n) => n.event), ["vote"]);

    // Chat has its own bucket
    const chat = nextEvent(voter, "chatMessage");
    voter.emit("chat", { content: "still here" });
    await chat;
  });

  it("limits joins per IP across sockets", async () => {
    const limited = await startTestServer({ limits: { joinPerIp: { burst: 2, perMinute: 1 } } });
    const sockets: ClientSocket[] = [];
    try {
      for (let i = 0; i < 2; i++) {
        const s = await connectClient(limited.url);
        sockets.push(s);
        await joinRoom(s, `p${i}`);
      }
      const third = await connectClient(limited.url);
      sockets.push(third);
      const notice = nextEvent<{ event: string }>(third, "rateLimited");
      third.emit("join", { roomId: ROOM_ID, participantId: "p2", name: "p2", isSpectator: false });
      assert.equal((await notice).event, "join");
      assert.equal(rooms.getRoom(ROOM_ID)?.participants.has("p2"), false);
    } finally {
      for (const s of sockets) s.disconnect();
      await limited.close();
    }
  });
});

describe("POST /api/rooms rate limit", () => {
  let server: TestServer;

  before(async () => {
    resetRoomCreateLimiter();
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
    resetRoomCreateLimiter();
  });

  const create = (ip: string) =>
    fetch(`${server.url}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: "{}",
    });

  it("answers 429 with Retry-After once an IP passes the burst", async () => {
    for (let i = 0; i < LIMITS.roomCreate.burst; i++) {
      assert.equal((await create("198.51.100.1")).status, 201);
    }
    const blocked = await create("198.51.100.1");
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    const body = await blocked.json();
    assert.equal(body.code, "RATE_LIMITED");
    assert.match(body.error, /Too many rooms/);

    // Another client is unaffected
    assert.equal((await create("198.51.100.2")).status, 201);
  });

  it("does not limit other routes", async () => {
    for (let i = 0; i < LIMITS.roomCreate.burst + 5; i++) {
      const res = await fetch(`${server.url}/api/rooms?id=x`, { headers: { "X-Forwarded-For": "198.51.100.1" } });
      assert.equal(res.status, 201);
    }
  });
});
