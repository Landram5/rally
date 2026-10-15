-- Discord announcements can go to their own channel, and match results are opt-in (off by default).
ALTER TABLE discord_links ADD COLUMN announce_matches INTEGER NOT NULL DEFAULT 0 CHECK(announce_matches IN (0,1));
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN announce_channel_id TEXT;
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN announce_channel_name TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN announce_webhook_id TEXT;
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN announce_webhook_token TEXT;
