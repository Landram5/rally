-- Open play: members tell their club they are at the venue and want a game.
-- Rows are short-lived (expires_at) and are ended on check-out; account deletion cascades.
CREATE TABLE open_play (
 id TEXT PRIMARY KEY,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=120),
 started_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 ended_at TEXT
);
CREATE UNIQUE INDEX idx_open_play_active ON open_play(club_id,player_id) WHERE ended_at IS NULL;
CREATE INDEX idx_open_play_club ON open_play(club_id,expires_at);
