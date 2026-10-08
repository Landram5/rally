-- Account-level interface preferences so colour, mode and dismissed hints follow the player across devices.
CREATE TABLE ui_preferences (
 player_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 palette TEXT NOT NULL DEFAULT 'forest' CHECK(palette IN ('forest','ink','ocean','plum')),
 appearance TEXT NOT NULL DEFAULT 'light' CHECK(appearance IN ('light','dark','system')),
 onboarding_hidden INTEGER NOT NULL DEFAULT 0 CHECK(onboarding_hidden IN (0,1)),
 updated_at TEXT NOT NULL
);
