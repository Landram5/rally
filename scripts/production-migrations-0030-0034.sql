-- Production rollout: migrations 0030 to 0034 (club chat, direct messages, photo and video attachments, group chats, Discord bridge).
-- Additive only: new tables, one index and two columns on chat_messages, and one hidden profile row used for Discord messages. Existing data is not changed.
-- Run once, after exporting the database. If Cloudflare reports a temporary import error, run it again (a failed run changes nothing).

-- ===== 0030_club_chat =====
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

CREATE INDEX idx_chat_media_pending ON chat_media(attached_at,created_at);

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

CREATE INDEX idx_chat_club_time ON chat_messages(club_id,created_at,id);

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

CREATE TABLE chat_mutes (
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 muted_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(club_id,player_id)
);

-- Per member and club: when they last read the chat, whether they want push alerts, and when the last alert was sent.
CREATE TABLE chat_members (
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 last_read_at TEXT NOT NULL DEFAULT '',
 notify INTEGER NOT NULL DEFAULT 0 CHECK(notify IN (0,1)),
 last_push_at TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(club_id,player_id)
);

-- A photo or video can be attached to only one message.
CREATE UNIQUE INDEX idx_chat_media_once ON chat_messages(media_id) WHERE media_id IS NOT NULL;

-- ===== 0031_direct_messages =====
-- Direct messages, blocking and safety reports.
CREATE TABLE dm_threads (
 id TEXT PRIMARY KEY NOT NULL,
 a_id TEXT NOT NULL REFERENCES profiles(id),
 b_id TEXT NOT NULL REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 last_message_at TEXT NOT NULL DEFAULT '',
 CHECK(a_id<b_id),
 UNIQUE(a_id,b_id)
);

CREATE INDEX idx_dm_threads_b ON dm_threads(b_id);

CREATE TABLE dm_messages (
 id TEXT PRIMARY KEY NOT NULL,
 thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES profiles(id),
 author_name TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(trim(body))>0 AND length(body)<=2000),
 client_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 deleted_at TEXT,
 UNIQUE(author_id,client_id)
);

CREATE INDEX idx_dm_messages_thread ON dm_messages(thread_id,created_at,id);

CREATE TABLE dm_state (
 thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 last_read_at TEXT NOT NULL DEFAULT '',
 last_push_at TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(thread_id,player_id)
);

CREATE TABLE dm_settings (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id),
 notify INTEGER NOT NULL DEFAULT 1 CHECK(notify IN (0,1))
);

-- Blocking is one way: the blocker no longer sees the other person's messages and the other person cannot message them.
CREATE TABLE blocks (
 blocker_id TEXT NOT NULL REFERENCES profiles(id),
 blocked_id TEXT NOT NULL REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(blocker_id,blocked_id),
 CHECK(blocker_id<>blocked_id)
);

CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- Reports about a direct message or a person. The snapshot keeps what the reporter chose to share even if the message is later deleted.
CREATE TABLE safety_reports (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('dm','user')),
 reporter_id TEXT NOT NULL REFERENCES profiles(id),
 target_id TEXT NOT NULL REFERENCES profiles(id),
 message_id TEXT,
 snapshot TEXT NOT NULL DEFAULT '',
 reason TEXT NOT NULL DEFAULT '' CHECK(length(reason)<=500),
 created_at TEXT NOT NULL,
 resolved_at TEXT,
 resolved_by TEXT REFERENCES profiles(id)
);

CREATE INDEX idx_safety_reports_open ON safety_reports(resolved_at,created_at);

-- ===== 0032_dm_media =====
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

CREATE INDEX idx_dm_media_pending ON dm_media(attached_at,created_at);

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

INSERT INTO dm_messages_new(id,thread_id,author_id,author_name,body,client_id,created_at,deleted_at) SELECT id,thread_id,author_id,author_name,body,client_id,created_at,deleted_at FROM dm_messages;

DROP TABLE dm_messages;

ALTER TABLE dm_messages_new RENAME TO dm_messages;

CREATE INDEX idx_dm_messages_thread ON dm_messages(thread_id,created_at,id);

CREATE UNIQUE INDEX idx_dm_media_once ON dm_messages(media_id) WHERE media_id IS NOT NULL;

-- ===== 0033_leader_rooms =====
-- Leader rooms: chat rooms that club organizers and board members create and invite leaders of other clubs into.
CREATE TABLE leader_rooms (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name))>0 AND length(name)<=80),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=300),
 created_by TEXT NOT NULL REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 archived_at TEXT
);

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

CREATE INDEX idx_room_members_player ON room_members(player_id,status);

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

CREATE INDEX idx_room_media_pending ON room_media(attached_at,created_at);

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

CREATE INDEX idx_room_messages_room ON room_messages(room_id,created_at,id);

CREATE UNIQUE INDEX idx_room_media_once ON room_messages(media_id) WHERE media_id IS NOT NULL;

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

INSERT INTO safety_reports_new SELECT id,kind,reporter_id,target_id,message_id,snapshot,reason,created_at,resolved_at,resolved_by FROM safety_reports;

DROP TABLE safety_reports;

ALTER TABLE safety_reports_new RENAME TO safety_reports;

CREATE INDEX idx_safety_reports_open ON safety_reports(resolved_at,created_at);

-- ===== 0034_discord_bridge =====
-- Discord bridge: a club's chat can be linked to one Discord channel, both ways.
CREATE TABLE discord_links (
 club_id TEXT PRIMARY KEY NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL UNIQUE,
 channel_name TEXT NOT NULL DEFAULT '',
 webhook_id TEXT NOT NULL,
 webhook_token TEXT NOT NULL,
 linked_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL
);

-- One-time codes an organizer generates in Rally and a Discord server admin redeems with /rally link.
CREATE TABLE discord_link_codes (
 code TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 created_by TEXT REFERENCES profiles(id),
 expires_at TEXT NOT NULL
);

-- Messages that came from Discord are stored under one shared "Discord" author (a hidden profile) with the sender's Discord name.
ALTER TABLE chat_messages ADD COLUMN source TEXT NOT NULL DEFAULT 'rally' CHECK(source IN ('rally','discord'));

ALTER TABLE chat_messages ADD COLUMN external_name TEXT;

INSERT OR IGNORE INTO profiles(id,name,created_at,deleted_at) VALUES('discord-bridge','Discord','2026-10-14T00:00:00.000Z','2026-10-14T00:00:00.000Z');
