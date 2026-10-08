-- Production rollout: migration 0028 (doubles tournaments). Adds one column to tournaments (default 1 = singles) and one table.
-- Existing tournaments and data are unchanged. Run once, after exporting the database.
-- Doubles tournaments. A tournament has team_size 1 (singles, the default) or 2 (doubles).
-- In a doubles tournament a registration is a team of two players; the draw uses team ids in place of player ids.
-- Results are written to doubles_matches, never to the singles matches table.
ALTER TABLE tournaments ADD COLUMN team_size INTEGER NOT NULL DEFAULT 1 CHECK(team_size IN (1,2));

CREATE TABLE doubles_teams (
 id TEXT PRIMARY KEY NOT NULL,
 tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 p1 TEXT NOT NULL REFERENCES profiles(id),
 p2 TEXT NOT NULL REFERENCES profiles(id),
 created_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 CHECK(p1<>p2)
);

CREATE INDEX idx_doubles_teams_event ON doubles_teams(tournament_id,created_at);

CREATE INDEX idx_doubles_teams_p1 ON doubles_teams(p1);

CREATE INDEX idx_doubles_teams_p2 ON doubles_teams(p2);

-- A player can be on only one team in a tournament, whichever slot they take.
CREATE TRIGGER doubles_team_unique_player BEFORE INSERT ON doubles_teams
WHEN EXISTS(SELECT 1 FROM doubles_teams t WHERE t.tournament_id=NEW.tournament_id AND (t.p1 IN (NEW.p1,NEW.p2) OR t.p2 IN (NEW.p1,NEW.p2)))
BEGIN SELECT RAISE(ABORT,'A player can only be on one team in a tournament.'); END;

-- Only doubles tournaments take teams.
CREATE TRIGGER doubles_team_only_doubles BEFORE INSERT ON doubles_teams
WHEN NOT EXISTS(SELECT 1 FROM tournaments WHERE id=NEW.tournament_id AND team_size=2)
BEGIN SELECT RAISE(ABORT,'This tournament is not a doubles event.'); END;
