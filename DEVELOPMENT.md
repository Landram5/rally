# Rally development status

## Implemented

- Supabase Auth with Google OAuth, email/password sign-up, email/password sign-in, password reset, password update, and server-managed cookie sessions.
- Public home page at `/` with searchable, paginated tournaments, players and verified matches from approved clubs. Member actions remain at `/clubhouse`; sign-in defaults to that workspace and preserves safe requested return paths.
- Durable D1 records for profiles, clubs, memberships, matches, audit events, tournaments, and tournament entries.
- Server-side authorization for all writes, including membership approval, result confirmation, tournament administration, and audit history.
- Public player and tournament pages limited to confirmed results and public event data.
- Tournament draws, seeding, byes, round robin standings, withdrawals, walkovers, result resets, and winner display.
- Original sample experience at `/demo`, separate from real accounts and records.
- Installable iPhone web app with a Home Screen icon, standalone display, safe-area layout, install instructions, and a privacy-safe offline fallback.
- Shared live/demo clubhouse interface with in-memory sample actions, past tournament draws in all three formats, scoring and resets, third place, guest registration, approvals and public sample statistics. The account demo illustrates ownership transfer and both deletion choices without contacting production services.
- Compact page headings, a player account dropdown, and scrollable match forms sized to the visible viewport, including a reduced viewport when the keyboard opens.

- Optional profile photos with face-photo guidance, square thumbnails, replacement/removal, public avatars, and deletion cleanup.
- Account settings edit the existing player username and optional public bio. Permanent unique Rally IDs are assigned to existing and new player profiles.
- Owners appoint active account holders as administrators or board members from Clubs > Club leadership. Both roles manage tournaments and verify games; only owners change leadership roles.
- Record match supports live tap-to-score tracking, win-by-two games, undo, side switching and final result submission.
- Club leaders upload club photos and banners. Signed-in players submit private feature requests and bug reports; site administrators manage their status.
- Club standings and tournament seeding share club-specific Elo ratings. Players remain provisional until five verified matches; established players rank first. Head-to-head selectors support player search and keyboard selection.
- Account settings offer Light, Dark and device-based appearance, saved per browser. Public rating guidance at `/ratings` explains the adapted Elo formula, tournament weights, time window and separation from official USATT ratings.
- Rally Elo weights regular matches 1x, single-club tournaments 2x and qualifying cross-club tournaments 3x. Point changes retain full value for 12 months, half value for the next 12, then expire. Five eligible matches in that window establish a player. Tournament weights are locked when the draw starts.

## Production configuration

- The merged website is deployed at https://rallytt.net with Cloudflare Worker routes and the existing production D1 database.
- Supabase Google sign-in, the final Site URL, allowed authentication redirects and server-only account-deletion credentials are configured.
- Account deletion requires ownership transfer and preserves shared records. Reviewed D1 migrations and the five-minute retry schedule are deployed.
- See `CONSOLIDATION.md` for backups, deployment versions, verification and the remaining real-iPhone release gates.
- Email signup, confirmation, password recovery and Home Screen session persistence still need end-to-end verification on a real iPhone.

## Next product work

- Public player and tournament discovery with search and filters.
- Guest account claims.
- Table/time scheduling, divisions, and organizer audit-history UI.
- Offline-friendly score entry and background synchronization.

## Validation

- `node scripts/account-deletion.test.mjs`
- `node scripts/demo.test.mjs`
- `node scripts/live-score-elo.test.mjs`
- `node scripts/rally-service.test.mjs`
- `node scripts/tournament-engine.test.mjs`
- `node --experimental-strip-types scripts/rally.test.mjs`
- `pnpm lint`
- `pnpm build`

Google OAuth, browser session persistence and logout were verified on rallytt.net. Email delivery and real-device flows remain on the release checklist.

Tournament creators can delete their events from the tournament panel. Migration 0010 stores creator identity and deletion timestamps. Deletion hides the event and voids its official results atomically; regular club matches remain. Existing events without recorded creators use the current club owner as a fallback. Active club membership is required. Account deletion clears creator identity while retaining the shared event.

Header safe-area padding and height now share one final CSS rule so compact mobile styles cannot collapse the header under the iPhone notch. Actual Home Screen safe-area behavior still requires device confirmation.

Club directories now link to dedicated /clubs/[id] pages (and /demo/clubs/[id] for samples). Approved clubs are publicly visible; private club access and management come from the authenticated clubhouse API. Bios are stored by migration 0011. Owners edit name/location/bio; existing leader permissions govern images, membership requests and guests. The management section is collapsed initially. Public server props are scoped to the selected club.

Overview standings show the first 10 players with an accessible expand/collapse control. Player directory search still shows the full filtered roster. Account Appearance appears immediately above Delete account, with explicit dark colors for danger controls. Profile photo uploads in both the profile dialog and account settings provide a crop preview, zoom, drag and keyboard-accessible position sliders. Cropped JPEGs are staged until Save profile. Account JSON limits permit profile photos up to the existing 256 KiB cap while retaining 4 KiB for other actions.

Run node scripts/photo-crop.test.mjs for crop geometry coverage. See PRODUCT_REVIEW.md for the post-change critique and next product decisions.
