import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initializeSocketIO } from "./socket";
import { runMigrations } from "./migrate";
import { rejectRoomCreation } from "./rateLimit";
import { startDbCleanup } from "./rooms";

if (process.argv.includes("--prod") && !process.env.NODE_ENV) {
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// A failed migration stops the server, so a bad deploy fails its health check.
const migrated = runMigrations().catch((err) => {
  console.error("Database migration failed:", err);
  process.exit(1);
});

migrated.then(() => app.prepare()).then(() => {
  const httpServer = createServer((req, res) => {
    try {
      if (rejectRoomCreation(req, res)) return;
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Initialize Socket.IO
  const io = initializeSocketIO(httpServer);

  // Delete rooms from the database once they have been idle past the retention period
  startDbCleanup();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO initialized`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down gracefully...");
    io.close(() => {
      console.log("Socket.IO closed");
      httpServer.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    });

    // Force exit after timeout
    setTimeout(() => {
      console.error("Force exit after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
