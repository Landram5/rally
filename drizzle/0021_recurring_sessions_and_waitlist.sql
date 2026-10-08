ALTER TABLE club_sessions ADD COLUMN repeat_weekly INTEGER NOT NULL DEFAULT 0 CHECK(repeat_weekly IN (0,1));
ALTER TABLE club_sessions ADD COLUMN recurrence_json TEXT;
ALTER TABLE club_sessions ADD COLUMN series_id TEXT REFERENCES club_sessions(id) ON DELETE SET NULL;
ALTER TABLE club_sessions ADD COLUMN occurrence INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_session_occurrence ON club_sessions(series_id,occurrence) WHERE series_id IS NOT NULL;

CREATE TABLE session_rsvps_next (
 session_id TEXT NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('going','not_going','maybe','waitlisted')),
 guests INTEGER NOT NULL DEFAULT 0 CHECK(guests IN (0,1)),
 queued_at TEXT,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(session_id,player_id)
);
INSERT INTO session_rsvps_next(session_id,player_id,status,updated_at) SELECT session_id,player_id,status,updated_at FROM session_rsvps;
DROP TABLE session_rsvps;
ALTER TABLE session_rsvps_next RENAME TO session_rsvps;
CREATE INDEX idx_session_waitlist ON session_rsvps(session_id,status,queued_at);

-- A party reserves one place for the player and one for their guest. FIFO parties are never split.
CREATE VIEW session_waitlist_promotions AS
WITH occupied AS (
 SELECT r.session_id,sum(1+r.guests) AS places FROM session_rsvps r
 JOIN club_sessions s ON s.id=r.session_id JOIN profiles p ON p.id=r.player_id
 JOIN memberships m ON m.club_id=s.club_id AND m.player_id=r.player_id
 WHERE r.status='going' AND m.status='active' AND p.deleted_at IS NULL GROUP BY r.session_id
), queue AS (
 SELECT r.session_id,r.player_id,s.capacity,sum(1+r.guests) OVER(PARTITION BY r.session_id ORDER BY r.queued_at,r.rowid ROWS UNBOUNDED PRECEDING) AS places
 FROM session_rsvps r JOIN club_sessions s ON s.id=r.session_id JOIN clubs c ON c.id=s.club_id
 JOIN profiles p ON p.id=r.player_id JOIN memberships m ON m.club_id=s.club_id AND m.player_id=r.player_id
 WHERE r.status='waitlisted' AND s.status='scheduled' AND s.ends_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND c.approval_status='approved' AND m.status='active' AND p.deleted_at IS NULL
)
SELECT q.session_id,q.player_id FROM queue q LEFT JOIN occupied o ON o.session_id=q.session_id WHERE q.capacity IS NULL OR q.places<=q.capacity-coalesce(o.places,0);

CREATE TRIGGER session_promote_insert AFTER INSERT ON session_rsvps BEGIN
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id=NEW.session_id AND player_id IN (SELECT player_id FROM session_waitlist_promotions WHERE session_id=NEW.session_id);
END;
CREATE TRIGGER session_promote_update AFTER UPDATE OF status,guests ON session_rsvps BEGIN
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id=NEW.session_id AND player_id IN (SELECT player_id FROM session_waitlist_promotions WHERE session_id=NEW.session_id);
END;
CREATE TRIGGER session_promote_delete AFTER DELETE ON session_rsvps BEGIN
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id=OLD.session_id AND player_id IN (SELECT player_id FROM session_waitlist_promotions WHERE session_id=OLD.session_id);
END;
CREATE TRIGGER session_promote_capacity AFTER UPDATE OF capacity ON club_sessions BEGIN
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id=NEW.id AND player_id IN (SELECT player_id FROM session_waitlist_promotions WHERE session_id=NEW.id);
END;
CREATE TRIGGER session_promote_membership_update AFTER UPDATE OF status ON memberships BEGIN
 UPDATE session_rsvps SET status='not_going',guests=0,queued_at=NULL WHERE player_id=NEW.player_id AND NEW.status!='active' AND session_id IN (SELECT id FROM club_sessions WHERE club_id=NEW.club_id);
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (session_id,player_id) IN (SELECT session_id,player_id FROM session_waitlist_promotions WHERE session_id IN (SELECT id FROM club_sessions WHERE club_id=NEW.club_id));
END;
CREATE TRIGGER session_promote_membership_delete AFTER DELETE ON memberships BEGIN
 UPDATE session_rsvps SET status='not_going',guests=0,queued_at=NULL WHERE player_id=OLD.player_id AND session_id IN (SELECT id FROM club_sessions WHERE club_id=OLD.club_id);
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (session_id,player_id) IN (SELECT session_id,player_id FROM session_waitlist_promotions WHERE session_id IN (SELECT id FROM club_sessions WHERE club_id=OLD.club_id));
END;
CREATE TRIGGER session_promote_profile_delete AFTER UPDATE OF deleted_at ON profiles WHEN NEW.deleted_at IS NOT NULL BEGIN
 UPDATE session_rsvps SET status='not_going',guests=0,queued_at=NULL WHERE player_id=NEW.id;
 UPDATE session_rsvps SET status='going',queued_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (session_id,player_id) IN (SELECT session_id,player_id FROM session_waitlist_promotions WHERE session_id IN (SELECT session_id FROM session_rsvps WHERE player_id=NEW.id));
END;
