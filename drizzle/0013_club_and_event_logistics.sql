ALTER TABLE clubs ADD COLUMN venue TEXT NOT NULL DEFAULT '';
ALTER TABLE clubs ADD COLUMN meeting_schedule TEXT NOT NULL DEFAULT '';
ALTER TABLE clubs ADD COLUMN contact TEXT NOT NULL DEFAULT '';
ALTER TABLE clubs ADD COLUMN joining_info TEXT NOT NULL DEFAULT '';
ALTER TABLE tournaments ADD COLUMN registration_closes_at TEXT;
ALTER TABLE tournaments ADD COLUMN starts_at TEXT;
ALTER TABLE tournaments ADD COLUMN check_in_open INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN checked_in_at TEXT;
CREATE TABLE tournament_fixture_plans (
 tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
 fixture_id TEXT NOT NULL,
 court TEXT NOT NULL DEFAULT '',
 starts_at TEXT,
 PRIMARY KEY(tournament_id,fixture_id)
);
CREATE INDEX idx_matches_status_date ON matches(status,played_on DESC,created_at DESC,id);
CREATE INDEX idx_tournaments_club_date ON tournaments(club_id,date,id);
CREATE INDEX idx_memberships_club_status ON memberships(club_id,status,player_id);
