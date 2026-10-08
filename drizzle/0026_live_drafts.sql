-- One in-progress live-scored match per account, so scoring can continue on another device.
-- The draft is validated server-side with the same rules as the on-device draft; it is removed when the match is saved or discarded.
CREATE TABLE live_drafts (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 draft_id TEXT NOT NULL,
 draft_json TEXT NOT NULL CHECK(length(draft_json)<=2000000),
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER live_draft_delete AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN DELETE FROM live_drafts WHERE player_id=NEW.id; END;
