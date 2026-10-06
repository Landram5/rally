ALTER TABLE profiles ADD COLUMN initial_rating INTEGER CHECK(initial_rating BETWEEN 200 AND 4000);
ALTER TABLE profiles ADD COLUMN initial_rating_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN initial_rating_operation TEXT;
CREATE TABLE rating_estimate_history (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 club_id TEXT NOT NULL REFERENCES clubs(id),
 actor_id TEXT REFERENCES profiles(id),
 before_rating INTEGER,
 after_rating INTEGER NOT NULL,
 note TEXT NOT NULL,
 revision INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 payload TEXT NOT NULL
);
CREATE INDEX rating_estimate_player ON rating_estimate_history(player_id,created_at);
CREATE TRIGGER summary_rating_estimate_update AFTER UPDATE OF initial_rating ON profiles
BEGIN UPDATE summary_epoch SET version=version+1 WHERE id=1; END;
