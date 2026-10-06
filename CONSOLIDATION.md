# Rally web and Home Screen release

## Working source

Use the top-level `rally-source` folder for development. The former `.sites-source` deployment checkout is preserved locally and excluded from Git and TypeScript. Comparison on October 5, 2026 found matching source content across 142 shared files after normalizing line endings and trailing whitespace. The shared private repository is https://github.com/Landram5/rally.

Create source backups with `powershell -NoProfile -File scripts/snapshot-source.ps1`. Archives in `.local-backups` include both Windows copies and SHA-256 manifests. They exclude secrets, databases, dependencies, and Git history. Keep the original checkouts until consolidation is complete. Production database backups are a separate release step.

## Release direction

Ship the website and Add to Home Screen experience. Native iOS, TestFlight, and App Store work are outside the active release. Preserve the Mac's native project before archiving that work. Use one shared private Git repository for Windows and Mac once the current source and Mac changes are reconciled.

## Mac merge dependency

The Mac source was retrieved on October 5, 2026. Its web changes have been merged into the top-level Windows source, retaining the new local archive exclusions and checklist. SHA-256 hashes were verified before importing the changed files. No native iOS files were added to the active web repository.

The full Mac source, including the native project, is preserved at `/Users/adamlandrum/Documents/Codex/2026-09-29/t/outputs/rally-consolidation-backups/rally-mac-preserved-20261005-183832.zip`. Windows source snapshots and the verified Mac web import remain in `.local-backups`.

Known Mac source location: `/Users/adamlandrum/Documents/Codex/2026-09-29/t/outputs/rally`.

Account-deletion, ownership-transfer, auth-rule, service, tournament, match-rule, TypeScript, lint, and production-build checks pass on Windows after the merge. Lint reports seven pre-existing warnings. No real accounts have been deleted. Real-device checks remain separate gates.

Account-deletion decisions already agreed:

- Preserve clubs and other members' records.
- Require club owners to transfer ownership before deleting their accounts.
- Offer removal of the deleting player's personal history while preserving shared records.
- Verify failure/retry behavior across D1 and Supabase before enabling deletion in production.

## Release gates

- [x] Retrieve and back up current Mac source and native project.
- [x] Merge and review Mac web changes, including account deletion.
- [x] Create a reviewed baseline commit and connect a private shared repository.
- [x] Pass auth-rule, service, tournament, lint, and production-build checks after merging.
- [x] Activate `rallytt.net` on Cloudflare and connect it to the Rally Worker.
- [x] Configure authentication callback and recovery URLs for the final domain.
- [ ] Verify signup, confirmation, Google login, recovery, logout, and session persistence on a real iPhone in Safari and from the Home Screen.
- [ ] Verify installation instructions, icons, standalone launch, safe areas, and offline fallback on that iPhone.
- [ ] Exercise club creation/joining/approval, scoring, brackets, third place, and public statistics on mobile.
- [x] Back up the production D1 database before migrations; record the prior Worker version for rollback.
- [x] Apply reviewed migrations and server-only configuration, deploy, and verify the live site.
- [ ] Connect the Mac to the shared repository before resuming development there. Remote Commander timed out during the final connection check; the preserved original Mac source remains intact.

## Production deployment — October 5, 2026

Live address: https://rallytt.net. Both `rallytt.net/*` and `www.rallytt.net/*` are Cloudflare Worker routes on the existing proxied DNS records. The Worker handles all requests directly; HTTP and www redirect to the HTTPS apex while preserving paths and query strings. Do not disable proxying or remove these routes. Native Cloudflare Custom Domains would require replacing the existing website A records; that migration is optional and has not been performed.

Supabase Site URL is `https://rallytt.net`. Exact `/auth/callback` and `/auth/confirm` redirects are allowed for apex and www; existing localhost and workers.dev redirects remain available. Google sign-in, session persistence across reload, logout, and the owner's disabled account-deletion state were verified in the browser on the new domain. Email signup, confirmation, recovery and actual Home Screen sessions still require end-to-end device checks.

Production D1 backup: `.local-backups/production-before-consolidation-20261005.sql`. DNS inventory: `.local-backups/dns-before-custom-domains-20261005.json`. These backups are excluded from Git. Prior Worker version: `bab2af21-4933-4825-b712-93912c9ae55a`. Released Worker version: `7f39a471-8374-487e-ad67-63ec368609a8`. Migrations 0004 and 0005 are applied; remote migration listing reports none pending. The server-only Supabase secret is configured and deletion retries run every five minutes. Read-only verification found zero pending deletions.

HTTPS homepage, login, install instructions, manifest, service worker, offline page and Home Screen icons return 200. HTTP and www return 308 to the canonical HTTPS address. The install layout was visually checked at 390 × 844; this does not replace Safari on an actual iPhone.

Browser emulation and automated checks do not replace the real-iPhone gates. Cloudflare DNS activation does not by itself connect the Worker or update authentication URLs.

## Streamlined interface update — October 5, 2026

Released Worker version: `dc87c4f8-fc1f-464b-be8f-516f8a60e791`; previous version: `7f39a471-8374-487e-ad67-63ec368609a8`. No database migrations or account-deletion behavior changed in this update.

The live site and `/demo` now share `app/rally-app.tsx`. Fictional demo actions use an isolated in-memory adapter and the production tournament engine; no sample changes are sent to Rally's APIs. Completed single elimination, double elimination and round robin events, third place, current competition and registration are seeded. Tournament status filters include past events. Sample public statistics and a separate ownership/deletion simulation are available from the demo.

Decorative slogans, redundant headings and slogan footers were removed. The signed-in header uses a dropdown for profile editing, account settings, installation and logout. Mobile forms use one consistent positioning method and a scroll container constrained to the visible viewport. Conflicting Tailwind translation utilities were removed from dialogs.

TypeScript, lint (three existing warnings), demo-state invariants, tournament-engine tests and the production build pass. Browser verification covered player selection, sample score submission with statistics updating, scrolling at 320 × 480, full form bounds at 390 × 844 and 1280 × 800, past-tournament filtering, completed brackets with third place, safe sample account transfer/deletion, and actual Google sign-in/logout through the new dropdown. Real iPhone keyboard and Home Screen checks remain on the checklist.


## Player profiles and club leadership - October 6, 2026

- Live Worker version: `9738b016-1cef-4199-97cf-84180a0793e0`.
- Migration `0006_profile_photos.sql` adds small JPEG thumbnails stored separately from profile/statistics reads, with cascade and soft-deletion cleanup. The photo picker accepts JPG/PNG/WebP originals up to 10 MB, crops and resizes to 320 square pixels, and explicitly asks for a clear face photo. Public image responses use `no-store`.
- Migration `0007_player_details_and_roles.sql` adds optional 500-character public bios and unique immutable `RLY-` IDs. Existing active profiles are backfilled; new profiles receive IDs automatically. Deletion clears both fields.
- Account settings edit the existing player name as Username and the public bio. IDs are read-only. No authentication credentials are changed.
- Club owners appoint or demote active account members using Clubs > Club leadership. Administrator and Board member roles can manage tournaments and verify results. Owner transfers remain a separate guarded operation. Guest, inactive, deleted, cross-club and non-owner appointment attempts are rejected.
- Ignored production backups: `.local-backups/production-before-photos-20261005.sql` and `.local-backups/production-before-player-details-20261006.sql`.
- Validation: TypeScript, lint (two existing warnings), production build, SQLite service/HTTP and account-deletion suites, demo state tests. Tests cover photo validation and self-only writes, atomic updates, public data, both deletion modes, permanent IDs, existing-player backfill, owner-only role changes, both roles' tournament/verification permissions, and revoked permissions after demotion.
- Browser checks: synthetic photo upload and display; username/bio saving with unchanged ID; public bio rendering; role selection; account form and leadership controls fit a 320-pixel mobile viewport. Production database and published demo are checked after deployment. Real iPhone release gates above remain.

## Live scoring, club images, feedback and rankings - October 6, 2026

- Released Worker version: `8f3c6f6a-cac7-452f-b1df-dd37286680e1`. Migration `0008_club_media_and_feedback.sql` is applied. Ignored production backup: `.local-backups/production-before-scoring-media-feedback-20261006.sql`.
- Record match offers manual scores or live point tracking with undo, side switching, reset confirmation and automatic games to 11, win by two. Completed results use the existing verification flow; live drafts are local and must be saved explicitly.
- Owners, administrators and board members can upload club photos and banners. JPEG thumbnails are stored separately; private club images require membership or site administrator access. Club images remain with the club when a member deletes their account.
- Account and public menus link to feedback. Signed-in profiles can submit five reports per rolling 24 hours, view their own reports and track status. Site administrators manage the private inbox. Account deletion removes submitted feedback.
- Elo starts at 1000 with K=32 and the standard 400-point expected-score scale. Ratings replay verified club matches in chronological order; pending and voided results are excluded. Established players with at least five matches rank ahead of provisional players, then Elo determines order, with played matches and wins breaking ties. Tournament seeding uses the same club-specific calculation.
- Both head-to-head selectors filter players by name, support keyboard selection and wrap long names on mobile.
- Validation passed: TypeScript, lint (two existing warnings), production build, live-score/Elo, service, demo and account-deletion suites. Tests cover deuce, undo across game boundaries, all match formats, Elo upsets and provisional ordering, media permissions and validation, feedback privacy, rate limits and deletion cleanup.
- Browser checks at 390 x 844 and 320 x 480 covered live scoring, side switching, undo, completed match saving with updated standings, club image uploads, feedback submission/status and searchable player selection. Final live-domain match saved successfully and updated Alex's sample record to 6-4 with Elo 1026. Synthetic demo actions did not create production records. Real iPhone release gates remain above.

## Chat link preview - October 6, 2026

Released Worker version: `742b9121-f0d6-4c19-8061-7f9daa651c2c`. Root metadata now includes Open Graph and large-image Twitter cards using the public 1200 x 630 PNG at `/rally-share-v2.png`. The banner uses Rally's green/lime palette, name, feature labels and domain; regenerate with `scripts/generate-share-banner.ps1`. TypeScript and production build passed. A public crawler-style HTTP request verified absolute image metadata in server HTML and a 200 image/png response. Chat applications control preview rendering and caching; actual Instagram/iMessage rendering was not tested.

Instagram DM follow-up: Worker `eeeb9359-7490-445a-8115-149334d7b385` adds required `og:url` and explicit secure image URL. The image has no top stripe and uses a fresh filename. Requests with `facebookexternalhit` and `meta-externalagent` user agents return 200 with metadata in the initial HTML head. This does not establish accessibility from Meta's actual IP addresses. Meta's Sharing Debugger requires Facebook login in the available browser, so its scrape result and the actual Instagram DM preview remain unverified.

## Public home page - October 6, 2026

Worker version `f414cd05-f449-4b13-9881-7b2a0339d5a8` serves a public home page at `/` with searchable tournaments, players and verified matches, 24 results per page, public detail links and top-right Sign in. Member management moves to `/clubhouse`; login defaults there and honors safe return paths. Account and profile-setup links target the new member route. Public data follows existing approved-club visibility rules, excludes unverified matches and deleted identities, and contains no private account fields or write controls. No migrations or authorization changes were required.

TypeScript, production build, lint (two existing warnings) and the SQLite service suite pass. Added cases verify public visibility, literal parameterized search, pagination and deleted-profile exclusion. Live anonymous HTTP checks return 200 for public home and 401 for the member API. Browser checks cover public tabs, player search, match empty state, Sign in and member workspace navigation, plus 390 x 844 and 320 x 480 layouts without horizontal overflow. Public directory/header links use native anchors after browser testing exposed a vinext client-link navigation error. Actual Instagram preview rendering still requires a fresh DM test or an authenticated Meta Sharing Debugger scrape.

## Appearance and time-weighted tournament Elo - October 6, 2026

Released Worker: `ea3b4692-65d7-4e5a-87e3-5605cccf2cc1`. Migration `0009_tournament_rating_weight.sql` is applied. Ignored backup: `.local-backups/production-before-tournament-weight-20261006.sql`.

Account settings and sample account settings provide Light, Dark and Use device setting. The existing next-themes package persists preferences under localStorage key `rally-appearance`; this is per browser, not synchronized to a player's account. Light remains the initial default. The provider sets the HTML class before hydration, and shared CSS covers public pages, account forms, standings, score dialogs and tournament sheets/brackets.

USATT's referenced page describes tournament ranking points rather than Elo. Rally retains opponent-sensitive Elo with a 1000 baseline and 400-point expected-score scale. K=32 for regular matches, K=64 for single-club tournaments and K=96 for cross-club tournaments. Changes count at full weight until the first calendar anniversary, half until the second, then zero; losses decay symmetrically. Ratings are replayed chronologically using time-weighted scores as of each match date, so expired evidence does not influence new expected scores. Future matches, pending/voided results, byes and walkovers do not contribute. Five non-expired verified matches establish a player; lifetime history statistics remain separate.

A cross-club tournament requires at least two entrants with active non-guest affiliations spanning at least two approved clubs. The compare-and-swap that starts a draw snapshots a 2x or 3x multiplier atomically. Later membership changes, resets, withdrawals and account deletion leave it unchanged. Registration previews use current affiliations. Existing locked draws default to 2x because historical club memberships cannot be reconstructed. Organizer input cannot assign the multiplier. Standings, seeding suggestions and automatic seeds use the same stored weight. The sample Interclub Open demonstrates 3x results.

`/ratings` explains formulas, examples, eligibility, time sensitivity, adaptations and the fact Rally scores are separate from official USATT ratings/rankings. Links appear in standings and tournament seeding guidance. No age/gender categories, USATT event tiers or placement awards were added.

Validation: TypeScript, production build, lint (one existing unused Flag warning), live-score/Elo, service, demo and account-deletion suites passed. New tests cover exact 12/24-month boundaries, leap-day anniversaries, symmetric ageing, future exclusion, 2x/3x point changes, expired opponent evidence, shared seeding, cross-club qualification, preview/locked multiplier parity, membership-change stability and reset stability. Browser checks verify saved theme selection after reload, device mode, mobile dark account settings, rating explanation and the readable Interclub Open bracket with its locked 3x label. The browser's original Light preference was restored after testing; temporary viewport overrides were cleared.

## Home Screen header and tournament deletion - October 6, 2026

Released Worker: 0d7fc3a7-5eea-4da8-8806-0b3131628660. Migration 0010_tournament_deletion.sql applied after backup to .local-backups/production-before-tournament-deletion-20261006.sql.

The compact header previously overrode standalone header height without removing safe-area padding. The final shared header rule now adds the top inset to its content height at desktop and mobile breakpoints. Live public-page checks at 390 x 844 and 320 x 480 confirm visible header content and no horizontal overflow. Actual iPhone Home Screen notch behavior remains a device verification gate.

New tournaments store their authenticated creator. An active club member who created an event can delete it after explicit confirmation; other organizers cannot delete that creator's event. Legacy events without recorded creators allow the current club owner. Deletion uses revision checking and an atomic batch to hide the event, void official results and append audit records. Public links return not found, discovery excludes the event, and statistics/ratings stop counting its results. Regular matches remain unchanged. Records are retained internally; no restore UI is provided. Creator account deletion clears that identity and enables the owner fallback without deleting shared events.

TypeScript, production build, lint (one existing unused Flag warning), service, demo and account-deletion suites passed. New cases cover creator forgery, creator-only permissions, revoked membership, demoted creators, legacy fallback, confirmation, stale revisions, official result cleanup, public visibility, retries, blocked writes after deletion and creator account cleanup. Live mobile demo verified cancellation and confirmed removal without touching production tournaments.

## Club pages, account layout and photo cropping - October 6, 2026

Released Worker: 7e344ecb-bec9-4ab2-b293-b321e9463773. Migration 0011_club_bio.sql applied after backup to .local-backups/production-before-club-pages-20261006.sql.

Club cards now open separate pages with a bio, location, member roster and tournament links. The public /clubs directory lists approved clubs; the member directory retains authorized private clubs and site-admin approval controls. Owner information editing, leader image uploads, guest creation and membership review move to the dedicated page. Management starts collapsed; signed-in club visitors see their account menu instead of Sign in. Only owners can edit club name/location/bio, with an atomic active-owner permission check. Other existing club permissions remain. Public initial props exclude unrelated clubs and player records. Sample edits survive navigation through browser session storage; Reset sample data remains available.

Appearance is directly above Delete account. Dark danger colors, radio controls, disabled buttons and card padding are explicit. Overview standings show 10 entries, with an expand/collapse button only when more exist. The Players tab remains a complete searchable directory.

Both profile upload entry points provide a client-side crop dialog: square output with circular avatar preview, 1x-3x zoom, drag positioning and labeled sliders. JPEG output is compressed to the existing photo size limit. Cancel leaves the existing photo intact; Use cropped photo stages it until Save profile. Account settings now show the current photo and allow removal. Account HTTP photo writes use existing self-only service validation. Streaming request limits remain 4 KiB for account actions other than save_profile, which allows up to 256 KiB.

Validation passed: TypeScript, production build, lint (one existing unused Flag warning), service, demo, account-deletion and new crop geometry tests. New service cases cover bio validation, owner and active-membership checks, anonymous roster privacy and photo upload/removal through account settings. Browser checks cover dark account order/colors, crop zoom/position/apply/save, crop cancellation over the profile dialog, sample club edit persistence, guest addition and standings 10 -> 11 -> 10. Live anonymous club directory/details work without edit controls; a read-only database check confirmed the existing deleted tournament is correctly excluded. Mobile layouts were checked at 390 x 844 and 320 x 480. Synthetic records stayed in the browser demo; production clubs/accounts were not edited. Test sample data and original Light theme were restored; viewport overrides were reset. Actual iPhone Home Screen photo selection, touch drag and keyboard behavior remain device verification gates.

Google sign-in investigation: existing code starts OAuth via the Rally /auth/google route and returns to /auth/callback, but Supabase is the OAuth intermediary. Official Supabase documentation supports a branded auth.rallytt.net custom domain via a paid-plan add-on, currently USD 10/month plus the plan. Setup requires Supabase activation, DNS verification and adding https://auth.rallytt.net/auth/v1/callback to Google's allowed callbacks before activation. No auth domain, paid service or billing setting was changed. Sources and next product options are in PRODUCT_REVIEW.md.

## Member discovery, registration and Inbox - October 6, 2026

Released Worker: 370f8e16-4a2f-4a88-85e3-0529293854ac. Migration 0012_notification_reads.sql applied after backup to .local-backups/production-before-inbox-20261006.sql.

Club pages add member name search, role filters and loading 20 rows at a time. Upcoming event cards show capacity, entry status and direct registration or entry-management actions. Public event pages link to the relevant clubhouse tournament and host membership page. Existing backend membership, capacity, revision and organizer checks continue to enforce mutations.

The in-app Inbox derives verification requests and eligible registration/start/ready-fixture/recent-result updates from authorized current activity. Per-account read receipts persist in D1, support mark-one/all, reject ineligible IDs and are cleaned up for both account-deletion modes. The demo supports the same inbox interactions in browser session storage. Resolved requests disappear; results expire after 30 days. This is not a permanent notification archive or email/push service; updates load on navigation/reload or after actions.

TypeScript, clean lint, production build, notification tests, service tests, demo tests and account-deletion tests passed. Live mobile checks at 390 x 844 and 320 x 480 verified six visible bottom-navigation tabs, removal of the unrelated Record match inbox action, individual read state surviving reload, mark-all, tournament notification links, public registration links, member filters and 20-to-21 load-more. Sample removal/rejoining used browser-only data. Synthetic edits and read state were reset, and viewport overrides removed. Screenshot: .local-backups/screenshots/inbox-mobile-final.jpg. Updated critique and discussion priorities are in PRODUCT_REVIEW.md.
