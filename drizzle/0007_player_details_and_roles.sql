ALTER TABLE profiles ADD COLUMN bio text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN rally_id text;
--> statement-breakpoint
UPDATE profiles SET rally_id='RLY-'||upper(hex(randomblob(6))) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_profiles_rally_id ON profiles(rally_id);
--> statement-breakpoint
CREATE TRIGGER profile_assign_rally_id AFTER INSERT ON profiles
WHEN NEW.deleted_at IS NULL AND NEW.rally_id IS NULL
BEGIN UPDATE profiles SET rally_id='RLY-'||upper(hex(randomblob(6))) WHERE id=NEW.id; END;
--> statement-breakpoint
CREATE TRIGGER profile_rally_id_immutable BEFORE UPDATE OF rally_id ON profiles
WHEN OLD.rally_id IS NOT NULL AND NEW.rally_id IS NOT OLD.rally_id AND NEW.deleted_at IS NULL
BEGIN SELECT RAISE(ABORT,'Rally ID cannot be changed.'); END;
--> statement-breakpoint
CREATE TRIGGER profile_clear_details AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN UPDATE profiles SET bio='',rally_id=NULL WHERE id=NEW.id; END;
