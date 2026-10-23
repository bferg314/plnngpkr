import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create postgres connection
const connectionString = process.env.DATABASE_URL;

// For migrations and server-side operations
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (connectionString) {
  const client = postgres(connectionString, {
    onnotice: () => {},
  });
  db = drizzle(client, { schema });
} else {
  // Database not configured - will use in-memory store
  if (process.env.NODE_ENV !== "test") {
    console.warn("DATABASE_URL not set - using in-memory storage");
  }
}

export { db };
export * from "./schema";
