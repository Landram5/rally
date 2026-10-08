-- Production rollout: migrations 0024 to 0027 (all additive: new tables, indexes and triggers only).
-- Run once, after exporting the database. Safe to read; nothing here changes or drops existing data.

-- ===== 0024_ui_preferences =====
-- Account-level interface preferences so colour, mode and dismissed hints follow the player across devices.
CREATE TABLE ui_preferences (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 palette TEXT NOT NULL DEFAULT 'forest' CHECK(length(palette)<=24),
 appearance TEXT NOT NULL DEFAULT 'light' CHECK(appearance IN ('light','dark','system')),
 onboarding_hidden INTEGER NOT NULL DEFAULT 0 CHECK(onboarding_hidden IN (0,1)),
 updated_at TEXT NOT NULL
);

-- ===== 0025_profile_photo_originals =====
-- Private, downscaled copy of the last uploaded profile photo so the owner can rotate or re-crop it later.
-- Only the owner can read it (via the account API); it is removed with the photo and with the account.
CREATE TABLE profile_photo_originals (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 image_data TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TRIGGER profile_photo_original_delete AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN DELETE FROM profile_photo_originals WHERE player_id=NEW.id; END;

-- ===== 0026_live_drafts =====
-- One in-progress live-scored match per account, so scoring can continue on another device.
-- The draft is validated server-side with the same rules as the on-device draft; it is removed when the match is saved or discarded.
CREATE TABLE live_drafts (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 draft_id TEXT NOT NULL,
 draft_json TEXT NOT NULL CHECK(length(draft_json)<=2000000),
 updated_at TEXT NOT NULL
);

CREATE TRIGGER live_draft_delete AFTER UPDATE OF deleted_at ON profiles
WHEN NEW.deleted_at IS NOT NULL
BEGIN DELETE FROM live_drafts WHERE player_id=NEW.id; END;

-- ===== 0027_doubles =====
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

CREATE INDEX idx_doubles_club_date ON doubles_matches(club_id,played_on);

CREATE INDEX idx_doubles_a1 ON doubles_matches(a1);

CREATE INDEX idx_doubles_a2 ON doubles_matches(a2);

CREATE INDEX idx_doubles_b1 ON doubles_matches(b1);

CREATE INDEX idx_doubles_b2 ON doubles_matches(b2);

CREATE TABLE doubles_audit (
 id TEXT PRIMARY KEY NOT NULL,
 match_id TEXT NOT NULL REFERENCES doubles_matches(id),
 actor_id TEXT NOT NULL REFERENCES profiles(id),
 action TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE INDEX idx_doubles_audit_match ON doubles_audit(match_id);
