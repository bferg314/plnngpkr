import path from "path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../src/lib/db";

// Apply pending migrations from drizzle/migrations before the server starts.
// Without DATABASE_URL the app runs in memory and there is nothing to migrate.
export async function runMigrations(): Promise<void> {
  if (!db) return;
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle", "migrations"),
  });
  console.log("> Database migrations applied");
}
