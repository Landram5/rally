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
