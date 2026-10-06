CREATE TABLE club_seasons (
 id text PRIMARY KEY NOT NULL, club_id text NOT NULL REFERENCES clubs(id),
 name text NOT NULL, starts_on text NOT NULL, ends_on text NOT NULL,
 closed_at text, created_by text REFERENCES profiles(id) ON DELETE SET NULL,
 revision integer NOT NULL DEFAULT 0, created_at text NOT NULL
);
CREATE INDEX idx_seasons_club_dates ON club_seasons(club_id,starts_on,ends_on);
CREATE TABLE season_players (
 season_id text NOT NULL REFERENCES club_seasons(id), player_id text NOT NULL REFERENCES profiles(id),
 status text NOT NULL DEFAULT 'active', created_at text NOT NULL,
 PRIMARY KEY(season_id,player_id)
);
CREATE TABLE notification_preferences (
 player_id text PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 match_updates integer NOT NULL DEFAULT 1, registration_updates integer NOT NULL DEFAULT 1,
 tournament_updates integer NOT NULL DEFAULT 1, record_updates integer NOT NULL DEFAULT 1,
 feedback_updates integer NOT NULL DEFAULT 1
);
ALTER TABLE feedback ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TABLE feedback_updates (
 id text PRIMARY KEY NOT NULL, feedback_id text NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
 status text NOT NULL, note text NOT NULL DEFAULT '', created_at text NOT NULL
);
CREATE INDEX idx_feedback_updates_request ON feedback_updates(feedback_id,created_at);
CREATE TABLE summary_epoch (id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL);
INSERT INTO summary_epoch VALUES(1,0);
CREATE TABLE clubhouse_summary_cache (
 scope_key text PRIMARY KEY NOT NULL, version integer NOT NULL, as_of text NOT NULL,
 summary_json text NOT NULL, created_at text NOT NULL
);
CREATE TRIGGER summary_match_insert AFTER INSERT ON matches BEGIN UPDATE summary_epoch SET version=version+1 WHERE id=1; END;
CREATE TRIGGER summary_match_update AFTER UPDATE ON matches BEGIN UPDATE summary_epoch SET version=version+1 WHERE id=1; END;
CREATE TRIGGER summary_match_delete AFTER DELETE ON matches BEGIN UPDATE summary_epoch SET version=version+1 WHERE id=1; END;
CREATE TRIGGER summary_tournament_update AFTER UPDATE ON tournaments BEGIN UPDATE summary_epoch SET version=version+1 WHERE id=1; END;
