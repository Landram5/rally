-- Short club addresses: rallytt.net/c/<slug> opens the club. A club keeps its old addresses when it picks a new one,
-- so printed flyers and shared links keep working.
CREATE TABLE club_slugs (
 slug TEXT PRIMARY KEY NOT NULL CHECK(slug=lower(slug) AND length(slug) BETWEEN 3 AND 30),
 club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 is_current INTEGER NOT NULL DEFAULT 1 CHECK(is_current IN (0,1)),
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_club_slugs_current ON club_slugs(club_id) WHERE is_current=1;
--> statement-breakpoint
CREATE INDEX idx_club_slugs_club ON club_slugs(club_id);
