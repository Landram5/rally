-- Doubles tournaments, part 2: team check-in and a team waitlist.
-- A waiting team has already chosen both players, so places go to the first waiting team automatically (no claim window).
ALTER TABLE doubles_teams ADD COLUMN checked_in_at TEXT;
--> statement-breakpoint
CREATE TABLE doubles_team_waitlist (
 id TEXT PRIMARY KEY NOT NULL,
 tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 p1 TEXT NOT NULL REFERENCES profiles(id),
 p2 TEXT NOT NULL REFERENCES profiles(id),
 created_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 CHECK(p1<>p2)
);
--> statement-breakpoint
CREATE INDEX idx_doubles_waitlist_event ON doubles_team_waitlist(tournament_id,created_at,id);
--> statement-breakpoint
-- A player can wait with only one team, and cannot wait while already on a team of the same tournament.
CREATE TRIGGER doubles_waitlist_unique_player BEFORE INSERT ON doubles_team_waitlist
WHEN EXISTS(SELECT 1 FROM doubles_team_waitlist t WHERE t.tournament_id=NEW.tournament_id AND (t.p1 IN (NEW.p1,NEW.p2) OR t.p2 IN (NEW.p1,NEW.p2)))
  OR EXISTS(SELECT 1 FROM doubles_teams t WHERE t.tournament_id=NEW.tournament_id AND (t.p1 IN (NEW.p1,NEW.p2) OR t.p2 IN (NEW.p1,NEW.p2)))
BEGIN SELECT RAISE(ABORT,'A player can only be on one team in a tournament.'); END;
--> statement-breakpoint
CREATE TRIGGER doubles_waitlist_only_doubles BEFORE INSERT ON doubles_team_waitlist
WHEN NOT EXISTS(SELECT 1 FROM tournaments WHERE id=NEW.tournament_id AND team_size=2)
BEGIN SELECT RAISE(ABORT,'This tournament is not a doubles event.'); END;
--> statement-breakpoint
-- A new team cannot take a place from players who are already waiting (promotion reuses the waiting team's own id).
CREATE TRIGGER doubles_team_not_waiting BEFORE INSERT ON doubles_teams
WHEN EXISTS(SELECT 1 FROM doubles_team_waitlist w WHERE w.tournament_id=NEW.tournament_id AND w.id<>NEW.id AND (w.p1 IN (NEW.p1,NEW.p2) OR w.p2 IN (NEW.p1,NEW.p2)))
BEGIN SELECT RAISE(ABORT,'A player can only be on one team in a tournament.'); END;
--> statement-breakpoint
-- When a team leaves, or the limit goes up, waiting teams fill the open places in joining order while registration is open.
CREATE TRIGGER doubles_promote_after_leave AFTER DELETE ON doubles_teams
BEGIN
 INSERT INTO doubles_teams(id,tournament_id,p1,p2,created_by,created_at)
 SELECT w.id,w.tournament_id,w.p1,w.p2,w.created_by,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM doubles_team_waitlist w JOIN tournaments t ON t.id=w.tournament_id
 WHERE w.tournament_id=OLD.tournament_id AND t.status='registration' AND t.deleted_at IS NULL
 ORDER BY w.created_at,w.rowid LIMIT max(0,coalesce((SELECT capacity FROM tournaments WHERE id=OLD.tournament_id)-(SELECT count(*) FROM doubles_teams WHERE tournament_id=OLD.tournament_id),0));
 DELETE FROM doubles_team_waitlist WHERE id IN (SELECT id FROM doubles_teams WHERE tournament_id=OLD.tournament_id);
END;
--> statement-breakpoint
CREATE TRIGGER doubles_promote_after_capacity AFTER UPDATE OF capacity ON tournaments
WHEN NEW.team_size=2 AND NEW.capacity>OLD.capacity AND NEW.status='registration'
BEGIN
 INSERT INTO doubles_teams(id,tournament_id,p1,p2,created_by,created_at)
 SELECT w.id,w.tournament_id,w.p1,w.p2,w.created_by,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM doubles_team_waitlist w
 WHERE w.tournament_id=NEW.id ORDER BY w.created_at,w.rowid LIMIT max(0,NEW.capacity-(SELECT count(*) FROM doubles_teams WHERE tournament_id=NEW.id));
 DELETE FROM doubles_team_waitlist WHERE id IN (SELECT id FROM doubles_teams WHERE tournament_id=NEW.id);
END;
