-- Auto-join invite links: anyone with the link joins the club immediately, without approval.
-- A club has at most one working link at a time; making a new one turns the old one off.
CREATE TABLE club_invites (
 token TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT,
 revoked_at TEXT,
 uses INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX idx_club_invites_club ON club_invites(club_id,revoked_at);
