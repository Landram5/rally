# Rally development status

## Implemented

- Supabase Auth with Google OAuth, email/password sign-up, email/password sign-in, password reset, password update, and server-managed cookie sessions.
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
