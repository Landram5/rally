CREATE TABLE account_write_blocks (auth_id text PRIMARY KEY NOT NULL, expires_at text NOT NULL);
--> statement-breakpoint
CREATE TABLE account_write_guards (auth_id text NOT NULL);
--> statement-breakpoint
CREATE TRIGGER account_write_check BEFORE INSERT ON account_write_guards
WHEN EXISTS (SELECT 1 FROM account_write_blocks WHERE auth_id=NEW.auth_id)
BEGIN SELECT RAISE(ABORT,'Account deletion in progress.'); END;
--> statement-breakpoint
CREATE TRIGGER account_write_cleanup AFTER INSERT ON account_write_guards
BEGIN DELETE FROM account_write_guards; END;
