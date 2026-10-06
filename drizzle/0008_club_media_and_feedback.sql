CREATE TABLE club_media (
 club_id text NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('photo','banner')),
 image_data text NOT NULL,
 updated_at text NOT NULL,
 PRIMARY KEY (club_id,kind)
);
--> statement-breakpoint
CREATE TABLE feedback (
 id text PRIMARY KEY NOT NULL,
 submitted_by text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 type text NOT NULL CHECK (type IN ('feature','bug')),
 title text NOT NULL,
 description text NOT NULL,
 page text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open',
 created_at text NOT NULL,
 updated_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_feedback_submitter_date ON feedback(submitted_by,created_at);
--> statement-breakpoint
CREATE TRIGGER feedback_delete_with_account AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN DELETE FROM feedback WHERE submitted_by=NEW.id; END;
