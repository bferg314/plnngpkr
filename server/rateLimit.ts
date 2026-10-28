import type { IncomingMessage, ServerResponse } from "http";

// Token bucket: `burst` requests at once, then `perMinute` sustained.
export interface RateLimit {
  burst: number;
  perMinute: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: RateLimit,
    private readonly now: () => number = Date.now
  ) {}

  take(key: string): RateLimitResult {
    const now = this.now();
    const refillPerMs = this.limit.perMinute / 60_000;
    const bucket = this.buckets.get(key) ?? { tokens: this.limit.burst, updatedAt: now };
    bucket.tokens = Math.min(
      this.limit.burst,
      bucket.tokens + (now - bucket.updatedAt) * refillPerMs
    );
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: Math.ceil((1 - bucket.tokens) / refillPerMs) };
  }

  delete(key: string): void {
    this.buckets.delete(key);
  }

  // Drop buckets that have refilled completely; they hold no state worth keeping.
  prune(): void {
    const now = this.now();
    const fullAfterMs = (this.limit.burst / this.limit.perMinute) * 60_000;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt >= fullAfterMs) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}

// Limits sit well above what a person clicking in the UI produces, so only
// scripts and stuck clients hit them.
export const LIMITS = {
  // POST /api/rooms, per client IP
  roomCreate: { burst: 10, perMinute: 6 },
  // join, per client IP. Generous because a team behind one office NAT joins together
  joinPerIp: { burst: 40, perMinute: 60 },
  // join, per socket. Reconnects open a new socket, so one socket rarely joins twice
  join: { burst: 5, perMinute: 10 },
  // chat, per socket
  chat: { burst: 10, perMinute: 30 },
  // vote and clearVote, per socket
  vote: { burst: 20, perMinute: 120 },
  // every other event, per socket
  default: { burst: 30, perMinute: 120 },
} satisfies Record<string, RateLimit>;

// Events with their own bucket; everything else shares the default bucket.
const EVENT_GROUPS: Record<string, keyof typeof LIMITS> = {
  join: "join",
  chat: "chat",
  vote: "vote",
  clearVote: "vote",
};

export function eventGroup(event: string): keyof typeof LIMITS {
  return EVENT_GROUPS[event] ?? "default";
}

// Client IP for per-IP limits. Production sits behind a tunnel, so every socket
// comes from the tunnel's address; the proxy appends the real client to
// X-Forwarded-For, which makes the last entry the one to trust. A client that
// reaches the server directly can forge the header to dodge its own limit but
// cannot use it to throttle anyone else. Set TRUST_PROXY=false to ignore it.
export function clientIp(
  remoteAddress: string | undefined,
  headers: IncomingMessage["headers"]
): string {
  if (process.env.TRUST_PROXY !== "false") {
    const forwarded = headers["x-forwarded-for"];
    const value = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
    const last = value?.split(",").map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return remoteAddress ?? "unknown";
}

// Shared across module reloads in development, like the room store.
const globalStore = globalThis as typeof globalThis & {
  __plnngpkr_roomCreateLimiter?: RateLimiter;
};

function roomCreateLimiter(): RateLimiter {
  if (!globalStore.__plnngpkr_roomCreateLimiter) {
    globalStore.__plnngpkr_roomCreateLimiter = new RateLimiter(LIMITS.roomCreate);
  }
  return globalStore.__plnngpkr_roomCreateLimiter;
}

export function resetRoomCreateLimiter(limiter?: RateLimiter): void {
  globalStore.__plnngpkr_roomCreateLimiter = limiter;
}

// Answers 429 and returns true when a POST /api/rooms is over its limit.
export function rejectRoomCreation(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "POST") return false;
  const pathname = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
  if (pathname !== "/api/rooms") return false;

  const limiter = roomCreateLimiter();
  limiter.prune();
  const result = limiter.take(clientIp(req.socket.remoteAddress, req.headers));
  if (result.allowed) return false;

  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
  res.statusCode = 429;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.end(
    JSON.stringify({
      error: `Too many rooms created. Try again in ${retryAfterSeconds} seconds.`,
      code: "RATE_LIMITED",
      retryAfterMs: result.retryAfterMs,
    })
  );
  return true;
}
