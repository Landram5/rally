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
