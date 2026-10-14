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
--> statement-breakpoint
CREATE INDEX idx_dm_threads_b ON dm_threads(b_id);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX idx_dm_messages_thread ON dm_messages(thread_id,created_at,id);
--> statement-breakpoint
CREATE TABLE dm_state (
 thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES profiles(id),
 last_read_at TEXT NOT NULL DEFAULT '',
 last_push_at TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(thread_id,player_id)
);
--> statement-breakpoint
CREATE TABLE dm_settings (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id),
 notify INTEGER NOT NULL DEFAULT 1 CHECK(notify IN (0,1))
);
--> statement-breakpoint
-- Blocking is one way: the blocker no longer sees the other person's messages and the other person cannot message them.
CREATE TABLE blocks (
 blocker_id TEXT NOT NULL REFERENCES profiles(id),
 blocked_id TEXT NOT NULL REFERENCES profiles(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(blocker_id,blocked_id),
 CHECK(blocker_id<>blocked_id)
);
--> statement-breakpoint
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX idx_safety_reports_open ON safety_reports(resolved_at,created_at);
