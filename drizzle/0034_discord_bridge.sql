-- Discord bridge: a club's chat can be linked to one Discord channel, both ways.
CREATE TABLE discord_links (
 club_id TEXT PRIMARY KEY NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL UNIQUE,
 channel_name TEXT NOT NULL DEFAULT '',
 webhook_id TEXT NOT NULL,
 webhook_token TEXT NOT NULL,
 linked_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL
);
--> statement-breakpoint
-- One-time codes an organizer generates in Rally and a Discord server admin redeems with /rally link.
CREATE TABLE discord_link_codes (
 code TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 created_by TEXT REFERENCES profiles(id),
 expires_at TEXT NOT NULL
);
--> statement-breakpoint
-- Messages that came from Discord are stored under one shared "Discord" author (a hidden profile) with the sender's Discord name.
ALTER TABLE chat_messages ADD COLUMN source TEXT NOT NULL DEFAULT 'rally' CHECK(source IN ('rally','discord'));
--> statement-breakpoint
ALTER TABLE chat_messages ADD COLUMN external_name TEXT;
--> statement-breakpoint
INSERT OR IGNORE INTO profiles(id,name,created_at,deleted_at) VALUES('discord-bridge','Discord','2026-10-14T00:00:00.000Z','2026-10-14T00:00:00.000Z');
