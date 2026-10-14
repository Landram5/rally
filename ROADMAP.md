# Rally releases

Release 1 is deployed: recoverable live scoring, clear profile navigation, interactive rating history and reliability checks. Actual iPhone session reopening remains a device verification item.

## Release 2 — player and organizer dashboards (implemented; device checks pending)

- My Rally: results requiring review, registered/upcoming events, registration eligibility, check-in and ready matches.
- Organizer: membership requests, result verification, event attendance, ready match queues and table/time assignments. Check-in remains attendance only; warn before starting with unchecked entrants.
- Profile cropping: Discord-style circular preview, one polished continuous zoom control, smooth focal-point pinch zoom and drag; keyboard access and reset.
- iPhone navigation: keep the bottom bar anchored on Overview, Players, Matches, Clubs, Tournaments and Inbox. Verify tab changes, scrolling, search focus, rotation and Home Screen safe areas on a device.

## Release 3 — registration and record ownership (deployed; device checks pending)

Implemented organizer opt-in for visiting-player registration, FIFO waitlists with automatic promotion, copy/download QR invitations, organizer-approved guest claims, and private match reviews with score snapshots and required reset reasons. Try /demo/records and Visiting Player Open in the sample demo. Real-device QR scanning and a real organizer/player pilot remain verification items.

## Release 4 — club competition and communication

Club ladders/seasons, notification preferences, feedback status tracking, and rating/standings caching as usage grows. Email and push delivery follow preference controls.


## Safety - October 7, 2026 (prepared; production configuration pending)

Branch `codex/safety` adds native write limits, Turnstile email-auth/feedback widgets and server-authorized owner/admin club CSV exports. No D1 migration. Security dependencies patched; required checks pass. See `SAFETY_RELEASE.md` and newest `HANDOFF.md` entry for configuration, validation and remaining live checks. Notifications, recurring sessions and tournament operations follow in separate PRs; doubles is deferred.

## Tournament operations — prepared for review

Scores-only tournament staff, dependency-aware table schedules and estimated finish, and reserved waitlist offers with claim deadlines. Stacked on safety, notifications and recurring sessions. Not deployed; provider configuration, migration approval and device/pilot checks remain. Doubles is a separate later project.

## Status as of October 14, 2026 (live on rallytt.net)

Deployed with production migrations 0028 to 0035: doubles tournaments, ratings and public leaderboard; scorekeepers, table schedules and waitlist offers; club chat with photos and videos; the profile-style club page; the Messages tab (direct messages, club chats, group chats, blocking and reporting); the UMBC colorway; the Discord bridge with announcements, `/club` commands and account linking. Docs: `DOUBLES.md`, `CHAT.md`, `MESSAGES.md`, `GROUP_CHATS.md`, `DISCORD.md`.

Still open:
- Check the signed-in chat, Messages and group chat screens on real phones, and the live-delivery behavior on mobile networks.
- Discord: Rally profile photos are not sent as Discord avatars (decision needed on exposing photos to Discord); multiple channels per club; per-event post settings.
- Apple sign-in work (`codex/apple-signin`) is not merged.
- Supabase leaked-password protection and the email flow checks.
- Older release notes above describe work that has since shipped; `HANDOFF.md` has the detailed history.
