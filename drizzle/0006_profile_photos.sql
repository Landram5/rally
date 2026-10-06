CREATE TABLE profile_photos (
 player_id text PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 image_data text NOT NULL,
 updated_at text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER profile_photo_delete AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN DELETE FROM profile_photos WHERE player_id=NEW.id; END;
