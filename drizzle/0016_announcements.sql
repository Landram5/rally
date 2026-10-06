CREATE TABLE announcements (
 id TEXT PRIMARY KEY NOT NULL,
 club_id TEXT REFERENCES clubs(id),
 author_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX announcements_club_date ON announcements(club_id,created_at);
CREATE TABLE announcement_seen (
 player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
 seen_at TEXT NOT NULL,
 PRIMARY KEY(player_id,announcement_id)
);
