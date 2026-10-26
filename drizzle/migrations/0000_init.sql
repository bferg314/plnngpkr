CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"deck_type" text NOT NULL,
	"custom_deck" jsonb,
	"settings" jsonb NOT NULL,
	"status" text DEFAULT 'active',
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"jira_key" text,
	"order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"final_estimate" jsonb,
	"cached_votes" jsonb,
	"cached_stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"estimated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vote_history" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"story_id" text NOT NULL,
	"participant_id" text,
	"participant_name" text NOT NULL,
	"value" jsonb NOT NULL,
	"voted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_history" ADD CONSTRAINT "vote_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_history" ADD CONSTRAINT "vote_history_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;