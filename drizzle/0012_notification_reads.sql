CREATE TABLE notification_reads (player_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, notification_id text NOT NULL, read_at text NOT NULL, PRIMARY KEY(player_id,notification_id));
CREATE TRIGGER notification_reads_delete_profile AFTER UPDATE OF deleted_at ON profiles WHEN NEW.deleted_at IS NOT NULL BEGIN DELETE FROM notification_reads WHERE player_id=NEW.id; END;
