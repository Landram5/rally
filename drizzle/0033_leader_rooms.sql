-- Leader rooms: chat rooms that club organizers and board members create and invite leaders of other clubs into.
CREATE TABLE leader_rooms (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name))>0 AND length(name)<=80),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=300),
 created_by TEXT NOT NULL REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 archived_at TEXT
);
--> statement-breakpoint
CREATE TABLE room_members (
 room_id TEXT NOT NULL REFERENCES leader_rooms(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 role TEXT NOT NULL CHECK(role IN ('owner','member')),
 status TEXT NOT NULL CHECK(status IN ('invited','active')),
 invited_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 last_read_at TEXT NOT NULL DEFAULT '',
 notify INTEGER NOT NULL DEFAULT 0 CHECK(notify IN (0,1)),
 last_push_at TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(room_id,player_id)
);
--> statement-breakpoint
CREATE INDEX idx_room_members_player ON room_members(player_id,status);
--> statement-breakpoint
CREATE TABLE room_media (
 id TEXT PRIMARY KEY NOT NULL,
 room_id TEXT NOT NULL REFERENCES leader_rooms(id) ON DELETE CASCADE,
 uploader_id TEXT NOT NULL REFERENCES profiles(id),
 kind TEXT NOT NULL CHECK(kind IN ('image','video')),
 content_type TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>0),
 r2_key TEXT NOT NULL,
 created_at TEXT NOT NULL,
 attached_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_room_media_pending ON room_media(attached_at,created_at);
--> statement-breakpoint
CREATE TABLE room_messages (
 id TEXT PRIMARY KEY NOT NULL,
 room_id TEXT NOT NULL REFERENCES leader_rooms(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES profiles(id),
 author_name TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '' CHECK(length(body)<=2000),
 media_id TEXT REFERENCES room_media(id),
 client_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 deleted_at TEXT,
 CHECK(length(trim(body))>0 OR media_id IS NOT NULL),
 UNIQUE(author_id,client_id)
);
--> statement-breakpoint
CREATE INDEX idx_room_messages_room ON room_messages(room_id,created_at,id);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_room_media_once ON room_messages(media_id) WHERE media_id IS NOT NULL;
--> statement-breakpoint
-- Safety reports can now be about a leader room message too (the table is rebuilt to allow the new kind).
CREATE TABLE safety_reports_new (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('dm','user','room')),
 reporter_id TEXT NOT NULL REFERENCES profiles(id),
 target_id TEXT NOT NULL REFERENCES profiles(id),
 message_id TEXT,
 snapshot TEXT NOT NULL DEFAULT '',
 reason TEXT NOT NULL DEFAULT '' CHECK(length(reason)<=500),
 created_at TEXT NOT NULL,
 resolved_at TEXT,
 resolved_by TEXT REFERENCES profiles(id)
);
--> statement-breakpoint
INSERT INTO safety_reports_new SELECT id,kind,reporter_id,target_id,message_id,snapshot,reason,created_at,resolved_at,resolved_by FROM safety_reports;
--> statement-breakpoint
DROP TABLE safety_reports;
--> statement-breakpoint
ALTER TABLE safety_reports_new RENAME TO safety_reports;
--> statement-breakpoint
CREATE INDEX idx_safety_reports_open ON safety_reports(resolved_at,created_at);
