# Club chat

Status: built and tested on `claude/club-chat`; not deployed.

## What it does
- One chat per club for **active members** (not pending, not guests). Text, photos and short videos.
- Live delivery over WebSockets through a Durable Object per club (`ChatRoom`). Messages are authorised and saved by the API first (`/api/chat`), then fanned out; if the socket drops the app polls every 8 seconds and catches up on reconnect.
- Organizers can delete any message, review reports and mute members. Anyone can delete their own messages and report others.
- Members can turn on push alerts per club (off by default). Alerts are skipped for people who are in the chat and limited to one per 10 minutes per club.
- A deleted account's messages stay, labelled `Deleted User (name)`. In "remove history" mode they move to a placeholder profile, keeping the name text.

## Media
- Stored in R2 (`CHAT_MEDIA`), served only to club members through `/api/chat/media/<id>` with range support so video seeks.
- Photos are shrunk on the phone (max 1600px) and must be 8 MB or less. Videos are not converted: 50 MB and about 30 seconds (checked in the app; the 50 MB cap is enforced by the server). iPhone HEVC videos may not play on some Android phones; Cloudflare Stream is the upgrade if that matters.
- Files are identified by their first bytes (JPEG, PNG, GIF, WebP, MP4/MOV, WebM), never by the name or declared type. Unsent uploads are removed after a day (scheduled job).

## Before it can go live (production steps)
1. Enable R2 on the Cloudflare account (dashboard, needs a payment method; the free tier is generous). Wrangler reports error 10042 until then.
2. Create the bucket: `pnpm exec wrangler r2 bucket create rally-chat-media`
3. Run migration `drizzle/0030_club_chat.sql` against `rally-table-tennis`.
4. Merge to `main`. The first deploy also registers the `ChatRoom` Durable Object (migration `chat-v1` in `wrangler.jsonc`).

## Tests
- `pnpm test:reliability` includes `scripts/club-chat.test.mjs` (rules, permissions, paging, limits, reports, mutes, unread, deleted users, account deletion).
- `pnpm test:chat-room` starts a local Worker and checks live fan-out, presence, refusal of unverified sockets, media type sniffing, size limits, R2 streaming and range requests.

## Not covered / limits
- The signed-in chat screen has not been used on a phone or in a browser (the preview has no sign-in).
- No threads, reactions, mentions, typing indicators or direct messages. Chat is not in the sample demo.
- Revoked members keep an open socket for up to 15 minutes at most (sockets renew and re-check membership).
