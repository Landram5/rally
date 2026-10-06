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
- Tournament divisions and organizer audit-history UI; table/time scheduling is available.
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
## Inbox, member discovery and tournament entry - October 6, 2026

Club rosters now support name search, role filters and loading 20 members at a time. Upcoming cards show registration status, capacity and the current player's entry, with direct registration for eligible active club members. Existing entrant removal and organizer tools open in the tournament panel. Public tournament pages explain eligibility and link back to club membership or the relevant signed-in tournament.

The in-app Inbox covers match verification requests, open registration, tournament starts, ready fixtures and recent results. Mark one/all as read persists per account through migration 0012_notification_reads.sql; anonymous reads contain no inbox or receipts. Read mutations validate the acting player's current eligible notifications and ignore supplied player identities. Both account-deletion modes remove receipts. Notifications are derived from current authorized activity, not a permanent event archive; resolved requests disappear and results age out after 30 days. Updates load on navigation/reload or after an action. No email or push is sent.

Production was backed up to .local-backups/production-before-inbox-20261006.sql before migration 0012. Validation passed: TypeScript, clean lint, production build, notification eligibility tests, backend persistence/privacy tests, demo tests and both account-deletion modes. Mobile demo checks verified combined roster filters, 20-to-21 loading, removing/rejoining an event, individual read persistence, mark-all and direct tournament opening. Review caught and fixed the mobile navigation's five-column limit after adding Inbox, ambiguous role labeling and the unrelated Record match action on Inbox.

Player panels now include rating history from the same replay used by standings. Expand each match to inspect opponent rating, expected win chance, original points and today's time-weighted contribution. History uses all authorized clubs, rather than the current standings club filter. Public profile pages remain limited to their existing public result data.

The clubhouse polls visible activity every 30 seconds and refreshes on focus/resume, pausing during editing. The Inbox also provides manual Refresh. A request version prevents older refresh results from replacing newer saves. Run node scripts/rating-history.test.mjs, node scripts/activity-refresh.test.mjs and node scripts/live-score-elo.test.mjs for related coverage.

## Club logistics, event operations and activity pagination — October 6, 2026

Migration 0013 adds public club venue, meeting times, contact and joining instructions; tournament registration deadlines, start times and check-in; entrant check-in timestamps; and court/time plans keyed by fixture. Owners edit club information. Existing organizer roles edit event details and fixture plans; players check themselves in when the organizer opens check-in. New entries and guest registration stop at the deadline. Existing entries can still be managed and the draw started. Server-side revision, identity and role checks enforce these rules atomically.

Date inputs submit native form values, normalize to UTC and display in the viewer's device time zone. Public event pages show saved schedules with round/fixture labels. Event detail and scheduling forms start collapsed. Check-in notices appear only for entered active club members who have not checked in.

The clubhouse uses compact summaries plus on-demand rating/event details. Matches, club rosters and event lists load 20 records per database page with stable ordering and visibility filters. All-history summary statistics preserve standings and head-to-head totals; they are not calculated from the first page. Club reads and post-edit refreshes are scoped to the selected club. Compact catalogs omit player bios/Rally IDs and full draws. Full authorized match history is still read server-side to replay ratings; catalog pagination and cached aggregates remain future scale work.

Rating history adds a trend chart and an all-clubs/individual-club scope selector. The rating rules are unchanged. Inbox verification links select the exact match, which identifies its submitter and eligible verifier. The demo seeds club details, event logistics and check-in notices, and supports the same operations without changing production records.

Regression coverage is in rally-service, demo, notifications, account-deletion, rating-history and live-score-elo tests. Production club checks caught a Server Component serialization restriction: internal null-prototype aggregation dictionaries must be converted to plain objects before passing page props. The service test now guards that boundary.

## Session continuity — October 6, 2026

proxy.ts renews expired Auth sessions before page rendering, propagating refreshed cookies to both the current request and browser response. It preserves Supabase's persistent cookie options and refresh cache headers, adding private/no-store for changed session responses. APIs and Auth callbacks keep their existing route-handler cookie persistence and are excluded from the proxy, along with static assets. Identity still comes from Auth getUser; stored cookie identity is never sufficient for authorization. Invalid/revoked refresh tokens clear the session normally.

PublicHeader now restores the current account through the private/no-store /api/auth/session endpoint and exposes a return to the member clubhouse. Public profiles, the home page and other public pages no longer unconditionally label signed-in visitors as signed out. Account state reloads on focus/resume; temporary fetch failures preserve a previously known account. No refresh token or email is exposed by the endpoint. Public browsing remains available without an account.

Run node scripts/auth-session.test.mjs for expired-token renewal, browser/request cookie propagation, persistent lifetime, reopening continuity, verified identity, anonymous browsing and revoked-session rejection. Browser checks cannot establish the actual iOS Home Screen process lifecycle; after an already-lost session, sign in once from the installed app and verify close/reopen on the device.

## Reliability release one — October 6, 2026

Live scoring persists one active match draft per account in localStorage, including club/players/date/best-of, point/game state, undo history, swapped sides and the stable result submission ID. The demo uses a separate sessionStorage key. Every point, undo or side switch writes synchronously; normal dialog closure preserves the draft. The clubhouse offers Resume/Discard and checks that the current club/players remain available before resuming. Completed scores also recover after reload. Successful server acknowledgment clears the matching draft; failed saves retain it, and existing result idempotency prevents duplicate retries. Switching to manual scoring or explicitly resetting the tracker discards that live draft. Stored data is validated on load, scoped to the acting account and never used as authorization.

Drafts are not server backups or submitted results; they do not synchronize across devices. Storage failures show an explicit warning. Clearing browser storage removes the draft. This is recovery for club-match live scoring, not offline background submission or tournament scoring. The regular server membership/score/verification rules still govern Save result.

Account names link to public profiles; the menu has separate Edit profile and View public profile items. Public headers obtain the authenticated player's own profile ID/name from the private session endpoint, without exposing tokens or email. Rating charts expose point details through touch/click, keyboard, a native selector, and Previous/Next controls. The selector disambiguates same-date points; original changes remain separate from today's aged contribution. Chart selection resets when rating scope changes.

Run pnpm test:reliability (or node scripts/reliability.test.mjs) for the session, redirect, draft, scoring, rating, real-SQLite service and demo regressions. Run pnpm lint, TypeScript and the production build alongside it before release. Browser verification uses synthetic demo scores and read-only real profile navigation. Actual iPhone Home Screen close/reopen remains a user-device check.


## Release two dashboards

Overview defaults to My Rally. Club leaders also have Organizer mode, with scoped approvals/verification, attendance and ready fixture scoring. Club overview keeps the existing standings and comparison tools. Server dashboard summaries precede compact paging; no migration is needed for this release. Photo cropping supports continuous pinch zoom and a single styled zoom control. Mobile navigation mounts directly under the document body to avoid changing tab layout affecting its fixed position.

Run pnpm test:reliability for dashboard eligibility/scoping, compact summary parity, crop geometry and existing account/scoring checks. See ROADMAP.md and PRODUCT_REVIEW.md for release limits and device verification.


## Release three registration and records

Migration 0014 adds visiting-player policy, FIFO waitlist rows, guest claim requests, result reviews, immutable score-change snapshots and match revisions. Production was exported before applying the migration. The account-deletion transaction removes personal request text and identity aliases, rewrites retained snapshots for remove-history deletion, and promotes the next eligible waiting player when a registration place opens.

A tournament defaults to host-club members only. Organizers may enable visiting players before the draw starts. Entrants can check in without club membership. Queue ordering uses creation time then SQLite rowid to preserve insertion order for ties. Entrant removal, capacity increases, reopened registration and account deletion promote waiting players while the deadline remains open. Starting a draw closes its waitlist. Existing accepted entrants/queued players retain their places when visiting-player registration is disabled; the toggle controls new registration. Guest additions cannot skip the queue.

Guest claims require an authenticated player and approval by a different active club leader. Approval atomically rechecks permissions, live identities, tournament revisions and identity collisions, then moves results, entries, draw identities, memberships and audit snapshots. Existing target memberships and the account's Rally ID/photo win; the guest photo is discarded. The old guest profile is a deleted alias whose public link resolves to the account. Profiles appearing opposite each other or together in one tournament cannot be merged automatically. All source guest clubs follow the verified identity; claims do not silently combine two account-backed players.

Match history/reviews are private to match players and active host-club leaders. Regular score corrections require a reason and matching result revision. Tournament corrections use reset/re-score draw controls, preserving downstream consistency and snapshots of every affected played result. Merely confirming a disputed match cannot resolve the dispute. Organizers either fix/reset it and resolve with an explanation, or reject it while retaining the original result. Inbox notices cover pending organizer reviews and claim/review decisions.

The QR SVG is generated locally by qrcode 1.5.4, with a white quiet area and canonical Rally URL; no third-party image service sees the invitation. /demo/records uses isolated session sample data. node scripts/reliability.test.mjs now includes release-three.test.mjs and account-deletion.test.mjs, exercising SQLite migrations, permission/race rollback, FIFO promotion, merges, corrections, deletion and demo isolation.
