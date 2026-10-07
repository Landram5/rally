CREATE TABLE club_sessions (
 id text PRIMARY KEY NOT NULL, club_id text NOT NULL REFERENCES clubs(id),
 title text NOT NULL, location text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 starts_at text NOT NULL, ends_at text NOT NULL, capacity integer,
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled')),
 created_by text REFERENCES profiles(id) ON DELETE SET NULL,
 revision integer NOT NULL DEFAULT 0, created_at text NOT NULL, updated_at text NOT NULL,
 operation_id text, operation_payload text,
 CHECK(ends_at>starts_at), CHECK(capacity IS NULL OR capacity>0)
);
CREATE INDEX idx_sessions_club_time ON club_sessions(club_id,starts_at);
CREATE TABLE session_rsvps (
 session_id text NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
 player_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('going','not_going')), updated_at text NOT NULL,
 PRIMARY KEY(session_id,player_id)
);
ALTER TABLE notification_preferences ADD COLUMN session_reminders integer NOT NULL DEFAULT 0;
ALTER TABLE notification_preferences ADD COLUMN tournament_reminders integer NOT NULL DEFAULT 0;
ALTER TABLE notification_preferences ADD COLUMN verification_reminders integer NOT NULL DEFAULT 0;
