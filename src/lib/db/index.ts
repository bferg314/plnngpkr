import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create postgres connection
const connectionString = process.env.DATABASE_URL;

// For migrations and server-side operations
let db: ReturnType<typeof drizzle>;

if (connectionString) {
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
} else {
  // Database not configured - will use in-memory store
  console.warn("DATABASE_URL not set - using in-memory storage");
  db = null as any;
}

export { db };
export * from "./schema";
