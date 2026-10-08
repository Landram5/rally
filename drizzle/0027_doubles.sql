-- Doubles matches live in their own tables so singles ratings, statistics and leaderboards are never affected.
-- Side A is a1+a2, side B is b1+b2. Status mirrors singles: pending (awaiting an opponent), confirmed, voided.
CREATE TABLE doubles_matches (
 id TEXT PRIMARY KEY NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id),
 a1 TEXT NOT NULL REFERENCES profiles(id),
 a2 TEXT NOT NULL REFERENCES profiles(id),
 b1 TEXT NOT NULL REFERENCES profiles(id),
 b2 TEXT NOT NULL REFERENCES profiles(id),
 games TEXT NOT NULL,
 best_of INTEGER NOT NULL CHECK(best_of IN (1,3,5,7)),
 played_on TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','voided')),
 submitted_by TEXT NOT NULL REFERENCES profiles(id),
 confirmed_by TEXT REFERENCES profiles(id),
 tournament_id TEXT REFERENCES tournaments(id),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 CHECK(a1<>a2 AND a1<>b1 AND a1<>b2 AND a2<>b1 AND a2<>b2 AND b1<>b2)
);
--> statement-breakpoint
CREATE INDEX idx_doubles_club_date ON doubles_matches(club_id,played_on);
--> statement-breakpoint
CREATE INDEX idx_doubles_a1 ON doubles_matches(a1);
--> statement-breakpoint
CREATE INDEX idx_doubles_a2 ON doubles_matches(a2);
--> statement-breakpoint
CREATE INDEX idx_doubles_b1 ON doubles_matches(b1);
--> statement-breakpoint
CREATE INDEX idx_doubles_b2 ON doubles_matches(b2);
--> statement-breakpoint
CREATE TABLE doubles_audit (
 id TEXT PRIMARY KEY NOT NULL,
 match_id TEXT NOT NULL REFERENCES doubles_matches(id),
 actor_id TEXT NOT NULL REFERENCES profiles(id),
 action TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_doubles_audit_match ON doubles_audit(match_id);
