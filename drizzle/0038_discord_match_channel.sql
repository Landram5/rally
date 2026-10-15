-- Match results can go to their own Discord channel, separate from announcements.
ALTER TABLE discord_links ADD COLUMN match_channel_id TEXT;
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN match_channel_name TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN match_webhook_id TEXT;
--> statement-breakpoint
ALTER TABLE discord_links ADD COLUMN match_webhook_token TEXT;
