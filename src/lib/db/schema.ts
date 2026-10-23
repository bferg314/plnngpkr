import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// Rooms table - stores room configuration
export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  deckType: text("deck_type").notNull(),
  customDeck: jsonb("custom_deck"),
  settings: jsonb("settings").notNull(),
  status: text("status").default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Stories table - stories within a room
export const stories = pgTable("stories", {
  id: text("id").primaryKey(), // nanoid
  roomId: text("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  jiraKey: text("jira_key"),
  order: integer("order").notNull(),
  status: text("status").default("pending").notNull(),
  finalEstimate: jsonb("final_estimate"),
  cachedVotes: jsonb("cached_votes"),
  cachedStats: jsonb("cached_stats"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  estimatedAt: timestamp("estimated_at"),
});

// Vote history table - persisted votes after reveal
export const voteHistory = pgTable("vote_history", {
  id: text("id").primaryKey(), // nanoid
  roomId: text("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  storyId: text("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  participantId: text("participant_id"),
  participantName: text("participant_name").notNull(),
  value: jsonb("value").notNull(),
  votedAt: timestamp("voted_at").defaultNow().notNull(),
});

// Type exports for use in the application
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

export type VoteHistory = typeof voteHistory.$inferSelect;
export type NewVoteHistory = typeof voteHistory.$inferInsert;
