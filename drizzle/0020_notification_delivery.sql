ALTER TABLE notification_preferences ADD COLUMN email_delivery INTEGER NOT NULL DEFAULT 0 CHECK(email_delivery IN (0,1));
ALTER TABLE notification_preferences ADD COLUMN push_delivery INTEGER NOT NULL DEFAULT 0 CHECK(push_delivery IN (0,1));

CREATE TABLE push_subscriptions (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 endpoint TEXT NOT NULL UNIQUE,
 p256dh TEXT NOT NULL,
 auth TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_push_player ON push_subscriptions(player_id);
CREATE TABLE notification_delivery_scans (
 player_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 scanned_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE notification_deliveries (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 notification_id TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('email','push')),
 device_id TEXT NOT NULL DEFAULT '',
 payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','skipped','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 retry_at INTEGER NOT NULL DEFAULT 0,
 UNIQUE(player_id,notification_id,channel,device_id)
);
CREATE INDEX idx_delivery_player ON notification_deliveries(player_id,status);
CREATE TRIGGER clear_deleted_player_delivery AFTER UPDATE OF deleted_at ON profiles WHEN NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM push_subscriptions WHERE player_id=NEW.id;
 DELETE FROM notification_deliveries WHERE player_id=NEW.id;
 DELETE FROM notification_delivery_scans WHERE player_id=NEW.id;
END;
