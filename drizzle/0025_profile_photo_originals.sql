-- Private, downscaled copy of the last uploaded profile photo so the owner can rotate or re-crop it later.
-- Only the owner can read it (via the account API); it is removed with the photo and with the account.
CREATE TABLE profile_photo_originals (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 image_data TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER profile_photo_original_delete AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN DELETE FROM profile_photo_originals WHERE player_id=NEW.id; END;
