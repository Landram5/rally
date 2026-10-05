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

Account-deletion, ownership-transfer, auth-rule, service, tournament, match-rule, TypeScript, lint, and production-build checks pass on Windows after the merge. Lint reports seven pre-existing warnings. No real accounts have been deleted. Production deployment and real-device checks remain separate gates.

Account-deletion decisions already agreed:

- Preserve clubs and other members' records.
- Require club owners to transfer ownership before deleting their accounts.
- Offer removal of the deleting player's personal history while preserving shared records.
- Verify failure/retry behavior across D1 and Supabase before enabling deletion in production.

## Release gates

- [x] Retrieve and back up current Mac source and native project.
- [x] Merge and review Mac web changes, including account deletion.
- [ ] Create a reviewed baseline commit and connect a private shared repository.
- [x] Pass auth-rule, service, tournament, lint, and production-build checks after merging.
- [ ] Activate `rallytt.net` on Cloudflare and connect it to the Rally Worker.
- [ ] Configure authentication callback and recovery URLs for the final domain.
- [ ] Verify signup, confirmation, Google login, recovery, logout, and session persistence on a real iPhone in Safari and from the Home Screen.
- [ ] Verify installation instructions, icons, standalone launch, safe areas, and offline fallback on that iPhone.
- [ ] Exercise club creation/joining/approval, scoring, brackets, third place, and public statistics on mobile.
- [ ] Back up the production D1 database before migrations; record the prior Worker version for rollback.
- [ ] Apply reviewed migrations and server-only configuration, deploy, and verify the live site.

Browser emulation and automated checks do not replace the real-iPhone gates. Cloudflare DNS activation does not by itself connect the Worker or update authentication URLs.
