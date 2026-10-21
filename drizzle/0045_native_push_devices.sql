-- Apple Push Notification service (APNs) device tokens for the native iOS app. Web Push stays in push_subscriptions.
CREATE TABLE native_push_devices (
 token TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
 created_at TEXT NOT NULL
);
CREATE INDEX idx_native_push_player ON native_push_devices(player_id);
CREATE TRIGGER clear_deleted_player_native_push AFTER UPDATE OF deleted_at ON profiles WHEN NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM native_push_devices WHERE player_id=NEW.id;
END;
