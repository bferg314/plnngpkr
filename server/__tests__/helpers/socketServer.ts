import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { AddressInfo } from "net";
import type { Server as SocketIOServer } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { initializeSocketIO, type SocketServerOptions } from "../../socket";
import { rejectRoomCreation } from "../../rateLimit";

export interface TestServer {
  url: string;
  io: SocketIOServer;
  close: () => Promise<void>;
}

// The production HTTP pipeline minus Next.js: the room-creation guard runs, then
// every request that gets past it answers 201.
export async function startTestServer(options: SocketServerOptions = {}): Promise<TestServer> {
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (rejectRoomCreation(req, res)) return;
    res.statusCode = 201;
    res.end("{}");
  });
  const io = initializeSocketIO(httpServer, options);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    io,
    close: () => new Promise<void>((resolve) => io.close(() => resolve())),
  };
}

export async function connectClient(url: string): Promise<ClientSocket> {
  const socket = ioClient(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}

// Resolves with the payload of the next `event`, or rejects after `timeoutMs`.
export function nextEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    const onEvent = (data: T) => {
      clearTimeout(timer);
      resolve(data);
    };
    socket.once(event, onEvent);
  });
}

// Collects every payload of `event` until stopped.
export function collect<T = unknown>(socket: ClientSocket, event: string): { items: T[]; stop: () => void } {
  const items: T[] = [];
  const onEvent = (data: T) => items.push(data);
  socket.on(event, onEvent);
  return { items, stop: () => socket.off(event, onEvent) };
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
