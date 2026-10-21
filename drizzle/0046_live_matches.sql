-- Matches a player has chosen to share live with their club. One per scorer; the match is still recorded and confirmed through the normal flow.
CREATE TABLE live_matches (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 a TEXT NOT NULL,
 b TEXT NOT NULL,
 best_of INTEGER NOT NULL,
 swapped INTEGER NOT NULL DEFAULT 0,
 state_json TEXT NOT NULL,
 draft_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX idx_live_matches_club ON live_matches(club_id,updated_at);
CREATE TRIGGER clear_deleted_player_live_matches AFTER UPDATE OF deleted_at ON profiles WHEN NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM live_matches WHERE player_id=NEW.id OR a=NEW.id OR b=NEW.id;
END;
