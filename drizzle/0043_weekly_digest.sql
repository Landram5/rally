-- Optional weekly summary email, and a record of which week it was sent so nobody gets it twice.
ALTER TABLE notification_preferences ADD COLUMN weekly_digest INTEGER NOT NULL DEFAULT 0 CHECK(weekly_digest IN (0,1));
--> statement-breakpoint
CREATE TABLE digest_sent (
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 week TEXT NOT NULL,
 sent_at TEXT NOT NULL,
 PRIMARY KEY(player_id,week)
);
