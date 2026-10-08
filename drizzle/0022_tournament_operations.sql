CREATE TABLE tournament_scorekeepers (
 tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 PRIMARY KEY(tournament_id,player_id)
);
ALTER TABLE tournaments ADD COLUMN table_count INTEGER NOT NULL DEFAULT 1 CHECK(table_count BETWEEN 1 AND 64);
ALTER TABLE tournaments ADD COLUMN estimated_match_minutes INTEGER NOT NULL DEFAULT 20 CHECK(estimated_match_minutes BETWEEN 5 AND 120);
ALTER TABLE tournaments ADD COLUMN estimated_ends_at TEXT;
ALTER TABLE tournaments ADD COLUMN claim_window_minutes INTEGER NOT NULL DEFAULT 1440 CHECK(claim_window_minutes BETWEEN 5 AND 1440);
ALTER TABLE tournament_fixture_plans ADD COLUMN ends_at TEXT;
ALTER TABLE tournament_fixture_plans ADD COLUMN called_at TEXT;
ALTER TABLE tournament_waitlist ADD COLUMN offered_at TEXT;
ALTER TABLE tournament_waitlist ADD COLUMN claim_expires_at TEXT;

CREATE VIEW eligible_tournament_waitlist AS
SELECT w.*,w.rowid AS queue_order,t.capacity,t.claim_window_minutes,t.registration_closes_at FROM tournament_waitlist w
JOIN tournaments t ON t.id=w.tournament_id JOIN clubs c ON c.id=t.club_id JOIN profiles p ON p.id=w.player_id
WHERE t.deleted_at IS NULL AND t.status='registration' AND c.approval_status='approved' AND p.deleted_at IS NULL
AND (t.registration_closes_at IS NULL OR t.registration_closes_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
AND NOT EXISTS(SELECT 1 FROM account_deletions ad WHERE ad.auth_id=p.auth_id)
AND NOT EXISTS(SELECT 1 FROM entries e WHERE e.tournament_id=w.tournament_id AND e.player_id=w.player_id)
AND (t.allow_visitors=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=t.club_id AND m.player_id=w.player_id AND m.status='active'));
CREATE VIEW tournament_waitlist_offers AS
WITH queue AS (
 SELECT w.*,row_number() OVER(PARTITION BY tournament_id ORDER BY created_at,queue_order) AS position FROM eligible_tournament_waitlist w WHERE offered_at IS NULL
)
SELECT q.id FROM queue q WHERE q.position<=q.capacity-(SELECT count(*) FROM entries e WHERE e.tournament_id=q.tournament_id)-(SELECT count(*) FROM eligible_tournament_waitlist w WHERE w.tournament_id=q.tournament_id AND w.claim_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'));

CREATE TRIGGER offer_after_entry_delete AFTER DELETE ON entries BEGIN
 UPDATE tournament_waitlist SET offered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),claim_expires_at=(SELECT min(coalesce(t.registration_closes_at,'9999'),strftime('%Y-%m-%dT%H:%M:%fZ','now','+'||t.claim_window_minutes||' minutes')) FROM tournaments t WHERE t.id=tournament_id) WHERE tournament_id=OLD.tournament_id AND id IN (SELECT id FROM tournament_waitlist_offers);
END;
CREATE TRIGGER offer_after_waitlist_insert AFTER INSERT ON tournament_waitlist BEGIN
 UPDATE tournament_waitlist SET offered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),claim_expires_at=(SELECT min(coalesce(t.registration_closes_at,'9999'),strftime('%Y-%m-%dT%H:%M:%fZ','now','+'||t.claim_window_minutes||' minutes')) FROM tournaments t WHERE t.id=tournament_id) WHERE tournament_id=NEW.tournament_id AND id IN (SELECT id FROM tournament_waitlist_offers);
END;
CREATE TRIGGER offer_after_waitlist_delete AFTER DELETE ON tournament_waitlist BEGIN
 UPDATE tournament_waitlist SET offered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),claim_expires_at=(SELECT min(coalesce(t.registration_closes_at,'9999'),strftime('%Y-%m-%dT%H:%M:%fZ','now','+'||t.claim_window_minutes||' minutes')) FROM tournaments t WHERE t.id=tournament_id) WHERE tournament_id=OLD.tournament_id AND id IN (SELECT id FROM tournament_waitlist_offers);
END;
CREATE TRIGGER offer_after_capacity_update AFTER UPDATE OF capacity,registration_closes_at,allow_visitors ON tournaments WHEN NEW.capacity!=OLD.capacity OR coalesce(NEW.registration_closes_at,'')!=coalesce(OLD.registration_closes_at,'') OR NEW.allow_visitors!=OLD.allow_visitors BEGIN
 DELETE FROM tournament_waitlist WHERE tournament_id=NEW.id AND (claim_expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR id NOT IN (SELECT id FROM eligible_tournament_waitlist));
 UPDATE tournament_waitlist SET offered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),claim_expires_at=(SELECT min(coalesce(t.registration_closes_at,'9999'),strftime('%Y-%m-%dT%H:%M:%fZ','now','+'||t.claim_window_minutes||' minutes')) FROM tournaments t WHERE t.id=tournament_id) WHERE tournament_id=NEW.id AND id IN (SELECT id FROM tournament_waitlist_offers);
 UPDATE tournament_waitlist SET claim_expires_at=min(claim_expires_at,NEW.registration_closes_at) WHERE tournament_id=NEW.id AND claim_expires_at IS NOT NULL AND NEW.registration_closes_at IS NOT NULL;
END;
CREATE TRIGGER scorekeeper_membership_update AFTER UPDATE OF status ON memberships WHEN NEW.status!='active' BEGIN
 DELETE FROM tournament_scorekeepers WHERE player_id=NEW.player_id AND tournament_id IN (SELECT id FROM tournaments WHERE club_id=NEW.club_id);
END;
CREATE TRIGGER scorekeeper_membership_delete AFTER DELETE ON memberships BEGIN
 DELETE FROM tournament_scorekeepers WHERE player_id=OLD.player_id AND tournament_id IN (SELECT id FROM tournaments WHERE club_id=OLD.club_id);
END;
CREATE TRIGGER scorekeeper_profile_delete AFTER UPDATE OF deleted_at ON profiles WHEN NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM tournament_scorekeepers WHERE player_id=NEW.id;
END;
