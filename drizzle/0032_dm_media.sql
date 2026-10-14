-- Photos and videos in direct messages. Files live in R2 under dm/<conversation>/<id>.
CREATE TABLE dm_media (
 id TEXT PRIMARY KEY NOT NULL,
 thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
 uploader_id TEXT NOT NULL REFERENCES profiles(id),
 kind TEXT NOT NULL CHECK(kind IN ('image','video')),
 content_type TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>0),
 r2_key TEXT NOT NULL,
 created_at TEXT NOT NULL,
 attached_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_dm_media_pending ON dm_media(attached_at,created_at);
--> statement-breakpoint
-- dm_messages is rebuilt so a message can be a photo or video with no text.
CREATE TABLE dm_messages_new (
 id TEXT PRIMARY KEY NOT NULL,
 thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES profiles(id),
 author_name TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '' CHECK(length(body)<=2000),
 media_id TEXT REFERENCES dm_media(id),
 client_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 deleted_at TEXT,
 CHECK(length(trim(body))>0 OR media_id IS NOT NULL),
 UNIQUE(author_id,client_id)
);
--> statement-breakpoint
INSERT INTO dm_messages_new(id,thread_id,author_id,author_name,body,client_id,created_at,deleted_at) SELECT id,thread_id,author_id,author_name,body,client_id,created_at,deleted_at FROM dm_messages;
--> statement-breakpoint
DROP TABLE dm_messages;
--> statement-breakpoint
ALTER TABLE dm_messages_new RENAME TO dm_messages;
--> statement-breakpoint
CREATE INDEX idx_dm_messages_thread ON dm_messages(thread_id,created_at,id);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_dm_media_once ON dm_messages(media_id) WHERE media_id IS NOT NULL;
