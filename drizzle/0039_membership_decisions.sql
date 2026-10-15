-- Remembers answers to join requests so the person is told (inbox, and phone or email alerts if on).
CREATE TABLE membership_decisions (
 id TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 decision TEXT NOT NULL CHECK(decision IN ('approved','declined')),
 decided_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_membership_decisions_player ON membership_decisions(player_id,decided_at);
