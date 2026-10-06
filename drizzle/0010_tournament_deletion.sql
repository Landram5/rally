ALTER TABLE tournaments ADD created_by text REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tournaments ADD deleted_at text;
CREATE INDEX idx_tournaments_deleted ON tournaments(deleted_at);
CREATE TRIGGER tournament_release_deleted_creator AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN UPDATE tournaments SET created_by=NULL WHERE created_by=NEW.id; END;
