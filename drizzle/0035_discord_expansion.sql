-- Discord expansion: automatic announcements, /club commands, and Rally-to-Discord account links.
-- Per-club switch for automatic posts (announcements, new sessions, tournament results). On by default.
ALTER TABLE discord_links ADD COLUMN announce INTEGER NOT NULL DEFAULT 1 CHECK(announce IN (0,1));
--> statement-breakpoint
-- Remembers what has already been posted so scheduled scans never post twice.
CREATE TABLE discord_posted (
 kind TEXT NOT NULL,
 ref_id TEXT NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 posted_at TEXT NOT NULL,
 PRIMARY KEY(kind,ref_id,club_id)
);
--> statement-breakpoint
-- A Rally player's Discord account. One Discord account belongs to one player.
CREATE TABLE discord_accounts (
 profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 discord_user_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
-- One-time codes a player generates in Rally and redeems in Discord with /club connect.
CREATE TABLE discord_connect_codes (
 code TEXT PRIMARY KEY NOT NULL,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL
);
