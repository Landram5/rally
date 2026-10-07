-- A reserved match scope preserves existing match foreign keys and public history.
-- It is not a joinable club and never contributes tournament affiliations.
INSERT INTO profiles(id,name,created_at) VALUES('rally-unaffiliated-system','Unaffiliated play','2026-10-07T00:00:00Z');
--> statement-breakpoint
INSERT INTO clubs(id,name,location,owner_id,approval_status,created_at)
VALUES('unaffiliated','Unaffiliated','','rally-unaffiliated-system','approved','2026-10-07T00:00:00Z');
--> statement-breakpoint
CREATE TRIGGER no_unaffiliated_membership BEFORE INSERT ON memberships
WHEN NEW.club_id='unaffiliated'
BEGIN SELECT RAISE(ABORT,'Unaffiliated play has no club memberships.'); END;
--> statement-breakpoint
CREATE TRIGGER no_unaffiliated_membership_update BEFORE UPDATE OF club_id ON memberships
WHEN NEW.club_id='unaffiliated'
BEGIN SELECT RAISE(ABORT,'Unaffiliated play has no club memberships.'); END;
--> statement-breakpoint
CREATE TRIGGER no_unaffiliated_tournament BEFORE INSERT ON tournaments
WHEN NEW.club_id='unaffiliated'
BEGIN SELECT RAISE(ABORT,'Choose a host club for tournaments.'); END;
