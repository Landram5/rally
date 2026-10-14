# Discord bridge

Status: built on `claude/discord-bridge` (stacked on the chat branches); not deployed. Needs migration `drizzle/0034_discord_bridge.sql`, which also needs `0030` (club chat).

A club's chat is linked to **one Discord channel**, both ways, like a Minecraft chat bridge:

- **Rally to Discord:** every new club chat message is posted into the channel through a webhook, under the sender's name, with mentions switched off (`@everyone` cannot ping). Photos and videos stay private in Rally and appear in Discord as a note ("Shared a photo in Rally").
- **Discord to Rally:** messages written in the channel appear in the club chat as "Name (Discord)", live. Attachments arrive as links. Bots, webhooks (including Rally's own) and system messages are ignored, so nothing loops.
- **Moderation:** club organizers can delete any Discord-sourced message from the chat, and Rally members can report them like any message (to the club's organizers). Blocking applies to Rally people only. Discord users are moderated in Discord.
- **Linking:** an organizer opens the club > Manage > Discord and generates a 6 character code (valid 15 minutes). A Discord server admin (Manage Server permission) runs `/rally link` with the code in the channel. `/rally unlink` and `/rally status` also work, and organizers can unlink from Rally.

## How it works (so we can expand it)
- `lib/discord.ts`: link codes, slash command handling, signature check, relay and ingest. Pure functions over D1 and an injectable `fetch`, with tests in `scripts/discord.test.mjs`.
- `lib/discord-gateway.ts`: a Durable Object (`DiscordGateway`) that holds the connection to Discord's gateway (heartbeats, identify, resume, reconnect through an alarm). It only connects while at least one club is linked. The scheduled job starts it. Tested against a fake Discord in `scripts/discord-gateway-smoke.mjs` (`pnpm test:discord-gateway`).
- `app/api/discord/interactions`: where Discord sends slash commands. Every request is verified with Discord's public key.
- `app/api/discord`: organizer API (status, generate code, unlink).
- Discord messages are stored in `chat_messages` with `source='discord'` under a hidden "Discord" profile; nobody appears as a Rally player because of them.

## Setting it up (you do this once; I never see the secrets)
1. Go to https://discord.com/developers/applications and create an application (for example "Rally"). Copy the **Application ID** and the **Public Key** from General Information.
2. Bot tab: add a bot, reset and copy its **token**. Under **Privileged Gateway Intents**, turn on **Message Content Intent** (required to read channel messages; Discord asks for verification only once the bot is in 100+ servers).
3. General Information: set **Interactions Endpoint URL** to `https://rallytt.net/api/discord/interactions`. Discord will test it, so the code must be deployed and the public key set first.
4. In the Rally project folder, set the three values as Cloudflare secrets (each command asks you to paste the value; nothing is saved in files):
   ```
   pnpm exec wrangler secret put DISCORD_BOT_TOKEN
   pnpm exec wrangler secret put DISCORD_PUBLIC_KEY
   pnpm exec wrangler secret put DISCORD_APP_ID
   ```
5. Register the slash commands once:
   ```
   $env:DISCORD_APP_ID="..."; $env:DISCORD_BOT_TOKEN="..."; node scripts/discord-register-commands.mjs
   ```
6. In Rally, open a club you organize, Manage > Discord > Link a Discord channel, follow the steps shown.

The bot invite link Rally shows asks for: View Channel, Send Messages, Read Message History and Manage Webhooks.

## Limits and ideas for later
- One channel per club (and a channel can belong to one club). Multiple channels, per-channel settings and threads are natural next steps.
- Discord people are not matched to Rally accounts yet, so Rally members see "Name (Discord)". Linking accounts would allow showing the Rally name and profile photo.
- Rally members' photos are not sent as Discord avatars (they are private).
- Tournament results, match announcements and session reminders could be posted to Discord with the same webhook.
- The gateway connection is one Durable Object for the whole site; it costs a small always-on Durable Object while any club is linked.
- Rally to Discord relays are best effort: if Discord rate limits or is down, that message is not retried.

## Expansion (migration 0035)
- **Announcements:** a linked club's channel gets a post when an organizer publishes a club announcement, when a session is created, and when a tournament finishes (the scheduled job checks; only tournaments finished after linking). Organizers can switch this off in Manage > Discord. Each post is remembered in `discord_posted`, so nothing posts twice.
- **/club commands** (register again with `scripts/discord-register-commands.mjs`): `/club leaderboard` and `/club next` work in a linked channel and answer for that club; `/club player <name>` works anywhere; `/club connect <code>` links a Discord account.
- **Account linking:** Rally Account > Discord gives a 6 character code (15 minutes); `/club connect` in Discord redeems it. A connected person who is an active club member shows with their Rally name in the bridged chat. No OAuth, no Discord email or other data is stored, only the user ID.
- Needs migration `drizzle/0035_discord_expansion.sql` before the code is deployed.
