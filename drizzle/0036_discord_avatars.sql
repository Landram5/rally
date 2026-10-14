-- Opt-in: a player can let Rally show their profile photo as the avatar on their club chat messages posted to Discord.
CREATE TABLE discord_avatar_optin (
 profile_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL
);
