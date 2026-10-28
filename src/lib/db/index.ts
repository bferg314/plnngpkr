import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create postgres connection
const connectionString = process.env.DATABASE_URL;

// For migrations and server-side operations
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

if (connectionString) {
  client = postgres(connectionString, {
    onnotice: () => {},
  });
  db = drizzle(client, { schema });
} else {
  // Database not configured - will use in-memory store
  if (process.env.NODE_ENV !== "test") {
    console.warn("DATABASE_URL not set - using in-memory storage");
  }
}

// Close the connection pool, so scripts and tests can exit.
export async function closeDb(): Promise<void> {
  await client?.end();
}

export { db };
export * from "./schema";
