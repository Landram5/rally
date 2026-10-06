# Rally workflow polish — October 6, 2026

Implemented the next five recommendations in SITE_REVIEW_2026-10-06.md.

1. Club pages have About, Members, Competition and Announcements sections, with a separate administrator Management section. Member role and initial-rating controls sit in collapsed member actions. Player links retain club and roster-search context.
2. Mobile player and season standings show rating, match count, W–L and provisional status in cards. Additional statistics expand on demand; desktop standings retain tables.
3. Match history supports searchable player and tournament filters, inclusive date ranges and My matches. Server counts and pagination use the same filters. Contextual actions retain existing verification and withdrawal permissions.
4. Member and public player views share a full page with Summary, Progress, Matches and Head-to-head sections. Opponent search, rating history and graphs remain available. Return links preserve the originating filters.
5. Account settings keep profile and sign-in controls first, followed by notifications and collapsed Club ownership. Appearance immediately precedes Delete account. Photo actions have a consistent narrow-screen layout.

Also corrected server/browser event-time formatting on the sample dashboard and routed organizer member-review links to Management.

## Validation

- Reliability regression suite passed, including new SQL-backed filter, pagination, visibility and permission tests.
- TypeScript, ESLint, production build and diff whitespace checks passed.
- Browser checks covered desktop, 390-pixel and 320-pixel layouts, match filters, invalid date ranges, profile return context, searchable opponents, club management disclosures and account ordering.
- Live signed-in account and match pages, public rating history and sample mobile standings were checked after deployment.
- No production records or preferences were modified during browser verification. No migrations were required.
- Actual iPhone standalone, Android installed mode and dark-mode visual checks remain for device verification.

Production: https://rallytt.net

Cloudflare version: `9368f54f-c8c7-4b27-9fcd-c59652184cb3`

Screenshot: `.local-backups/screenshots/workflow-mobile-standings.png` (local, ignored by Git).
