# Club sessions, tournament operations, and reminders

Deployed to https://rallytt.net on October 6, 2026.
Cloudflare version: `87fd7f01-43c9-468a-919e-56abffe9d26c`.

## Features

- Club Sessions tab: organizers create, edit, and cancel sessions; active members RSVP, see attendance, and download calendar events. Capacity checks are atomic and writes enforce current membership and organizer permissions.
- Tournament Operations tab: ready-match queue, table/time assignments, match calls with player inbox notices, scoring through the existing official workflow, and printable draw/match sheets. Conflict checks detect the same table and start time; they do not model table occupancy or overlapping match durations.
- Account notification preferences: opt-in reminders for upcoming sessions, tournament starts/registration deadlines, and overdue match verification. Defaults are off. Reminders are derived when Rally opens or refreshes; email and web push delivery are not enabled.
- Calendar exports include a 30-minute alert. The user must import the downloaded event into a calendar; delivery depends on the calendar client. Tournament calendar duration is explicitly an estimate.
- Sample sessions, attendance, assignments, and reminders remain isolated from production data.

## Validation

- Full reliability suite passed, including membership/revocation authorization, retry handling, concurrent last-place RSVP, stale revisions, notification opt-in/read state, and calendar escaping/UTF-8 line folding.
- TypeScript, lint, and production build passed.
- Browser checks: sample RSVP attendance, table assignment/call and inbox notice, session reminder opt-in and inbox notice, 320-pixel session form without horizontal overflow, desktop operations/print-sheet content, live reminder defaults, and live club session empty state.
- Browser mutations were confined to sample data. Production account/club checks were read-only.
- Actual installed iPhone/Android testing, physical print output, and calendar import/alert delivery remain unverified.

## Database and recovery

Applied additive D1 migration `0018_sessions_and_reminders.sql` before deployment.
The D1 SQL export endpoint rejected authentication; a full SQL export was not obtained. D1 Time Travel recovery information was successfully recorded before migration in the ignored local backup folder.
Pre-migration bookmark: `00000146-00000000-000050fd-36bbe7b4eece7eca8d6958e5c6758bf2`.

Browser proof images are saved locally in `.local-backups/screenshots/club-sessions-release.png` and `tournament-operations-release.png`.
