ALTER TABLE tournaments ADD COLUMN allow_visitors integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN merged_into text REFERENCES profiles(id);
ALTER TABLE matches ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TABLE tournament_waitlist (
 id text PRIMARY KEY NOT NULL,
 tournament_id text NOT NULL REFERENCES tournaments(id),
 player_id text NOT NULL REFERENCES profiles(id),
 created_at text NOT NULL,
 UNIQUE(tournament_id,player_id)
);
CREATE INDEX idx_waitlist_queue ON tournament_waitlist(tournament_id,created_at,id);
CREATE TABLE guest_claims (
 id text PRIMARY KEY NOT NULL,
 guest_id text NOT NULL REFERENCES profiles(id),
 claimant_id text NOT NULL REFERENCES profiles(id),
 club_id text NOT NULL REFERENCES clubs(id),
 evidence text NOT NULL,
 guest_name text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending',
 reviewed_by text REFERENCES profiles(id),
 created_at text NOT NULL,
 reviewed_at text
);
CREATE UNIQUE INDEX idx_claim_pending ON guest_claims(guest_id,claimant_id) WHERE status='pending';
CREATE INDEX idx_claim_club_status ON guest_claims(club_id,status);
CREATE TABLE match_reviews (
 id text PRIMARY KEY NOT NULL,
 match_id text NOT NULL REFERENCES matches(id),
 requested_by text NOT NULL REFERENCES profiles(id),
 note text NOT NULL,
 proposed_games text,
 match_revision integer NOT NULL,
 original_games text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 resolved_by text REFERENCES profiles(id),
 resolution text NOT NULL DEFAULT '',
 created_at text NOT NULL,
 resolved_at text
);
CREATE UNIQUE INDEX idx_review_pending ON match_reviews(match_id,requested_by) WHERE status='pending';
CREATE INDEX idx_review_match_status ON match_reviews(match_id,status);
CREATE TABLE match_history (
 id text PRIMARY KEY NOT NULL,
 match_id text NOT NULL REFERENCES matches(id),
 actor_id text NOT NULL REFERENCES profiles(id),
 action text NOT NULL,
 note text NOT NULL,
 before_json text NOT NULL,
 after_json text NOT NULL,
 created_at text NOT NULL
);
CREATE INDEX idx_history_match_time ON match_history(match_id,created_at);
