-- Club chat. Messages and media metadata live in D1; media files live in R2 and live delivery goes through a Durable Object per club.
CREATE TABLE chat_media (
 id TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 uploader_id TEXT NOT NULL REFERENCES profiles(id),
 kind TEXT NOT NULL CHECK(kind IN ('image','video')),
 content_type TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>0),
 r2_key TEXT NOT NULL,
 created_at TEXT NOT NULL,
 attached_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_chat_media_pending ON chat_media(attached_at,created_at);
--> statement-breakpoint
CREATE TABLE chat_messages (
 id TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES profiles(id),
 author_name TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '' CHECK(length(body)<=2000),
 media_id TEXT REFERENCES chat_media(id),
 client_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 deleted_at TEXT,
 deleted_by TEXT REFERENCES profiles(id),
 CHECK(length(trim(body))>0 OR media_id IS NOT NULL),
 UNIQUE(author_id,client_id)
);
--> statement-breakpoint
CREATE INDEX idx_chat_club_time ON chat_messages(club_id,created_at,id);
--> statement-breakpoint
CREATE TABLE chat_reports (
 id TEXT PRIMARY KEY NOT NULL,
 message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 reporter_id TEXT NOT NULL REFERENCES profiles(id),
 reason TEXT NOT NULL DEFAULT '' CHECK(length(reason)<=500),
 created_at TEXT NOT NULL,
 resolved_at TEXT,
 resolved_by TEXT REFERENCES profiles(id),
 UNIQUE(message_id,reporter_id)
);
--> statement-breakpoint
CREATE TABLE chat_mutes (
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 muted_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(club_id,player_id)
);
--> statement-breakpoint
-- Per member and club: when they last read the chat, whether they want push alerts, and when the last alert was sent.
CREATE TABLE chat_members (
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 last_read_at TEXT NOT NULL DEFAULT '',
 notify INTEGER NOT NULL DEFAULT 0 CHECK(notify IN (0,1)),
 last_push_at TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(club_id,player_id)
);
--> statement-breakpoint
-- A photo or video can be attached to only one message.
CREATE UNIQUE INDEX idx_chat_media_once ON chat_messages(media_id) WHERE media_id IS NOT NULL;
