ALTER TABLE profiles ADD deleted_at text;
--> statement-breakpoint
CREATE TABLE account_deletions (
 auth_id text PRIMARY KEY NOT NULL,
 requested_at text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 last_attempt_at text
);
--> statement-breakpoint
CREATE TRIGGER deletion_requires_transfer BEFORE INSERT ON account_deletions
WHEN EXISTS (SELECT 1 FROM clubs c JOIN profiles p ON p.id=c.owner_id WHERE p.auth_id=NEW.auth_id)
BEGIN SELECT RAISE(ABORT,'Transfer club ownership before deletion.'); END;
--> statement-breakpoint
CREATE TRIGGER no_pending_profile_insert BEFORE INSERT ON profiles
WHEN EXISTS (SELECT 1 FROM account_deletions WHERE auth_id=NEW.auth_id)
BEGIN SELECT RAISE(ABORT,'Account deletion in progress.'); END;
--> statement-breakpoint
CREATE TRIGGER no_deleted_profile_restore BEFORE UPDATE ON profiles
WHEN OLD.deleted_at IS NOT NULL AND (NEW.deleted_at IS NULL OR NEW.auth_id IS NOT NULL OR NEW.name!='Deleted player')
BEGIN SELECT RAISE(ABORT,'Deleted profiles cannot be restored.'); END;
--> statement-breakpoint
CREATE TRIGGER no_pending_profile_update BEFORE UPDATE OF auth_id ON profiles
WHEN NEW.auth_id IS NOT NULL AND EXISTS (SELECT 1 FROM account_deletions WHERE auth_id=NEW.auth_id)
BEGIN SELECT RAISE(ABORT,'Account deletion in progress.'); END;
--> statement-breakpoint
CREATE TRIGGER no_deleted_club_owner_insert BEFORE INSERT ON clubs
WHEN EXISTS (SELECT 1 FROM profiles WHERE id=NEW.owner_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Deleted players cannot own clubs.'); END;
--> statement-breakpoint
CREATE TRIGGER no_deleted_club_owner_update BEFORE UPDATE OF owner_id ON clubs
WHEN EXISTS (SELECT 1 FROM profiles WHERE id=NEW.owner_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Deleted players cannot own clubs.'); END;
--> statement-breakpoint
CREATE TRIGGER no_deleted_membership BEFORE INSERT ON memberships
WHEN EXISTS (SELECT 1 FROM profiles WHERE id=NEW.player_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Deleted players cannot join clubs.'); END;
--> statement-breakpoint
CREATE TRIGGER no_deleted_entry BEFORE INSERT ON entries
WHEN EXISTS (SELECT 1 FROM profiles WHERE id=NEW.player_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Deleted players cannot enter tournaments.'); END;
--> statement-breakpoint
CREATE TABLE deletion_revision_guards (tournament_id text NOT NULL, expected_revision integer NOT NULL);
--> statement-breakpoint
CREATE TRIGGER deletion_revision_check BEFORE INSERT ON deletion_revision_guards
WHEN NOT EXISTS (SELECT 1 FROM tournaments WHERE id=NEW.tournament_id AND revision=NEW.expected_revision)
BEGIN SELECT RAISE(ABORT,'Tournament changed during deletion.'); END;
--> statement-breakpoint
CREATE TRIGGER deletion_revision_cleanup AFTER INSERT ON deletion_revision_guards
BEGIN DELETE FROM deletion_revision_guards; END;
--> statement-breakpoint
CREATE TABLE account_change_guards (changed integer NOT NULL CHECK (changed=1));
--> statement-breakpoint
CREATE TRIGGER account_change_cleanup AFTER INSERT ON account_change_guards
BEGIN DELETE FROM account_change_guards; END;
