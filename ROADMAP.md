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
