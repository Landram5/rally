# Rally inbox and onboarding polish — October 6, 2026

Implemented the five approved follow-up improvements:

- Inbox: All / Unread / Action needed filters, task/update groups, descriptive actions, progressive display and timestamps where recorded. Reading does not resolve a task; resolved verification/review requests leave the current activity feed. Existing notification permissions and preferences remain authoritative.
- Announcements: constrained composer width, explicit audience, consistent headings, existing popup preview and corrected links to the club Announcements section. Browser validation used an unpublished draft only.
- Public clubs: combined name/location search, clear filters, result counts, useful empty state, consistent banner proportions and concise biographies.
- Ratings: practical summary and two examples derived from the existing calculation, with technical rules in expandable sections. No rating calculation changed.
- Onboarding: per-player, per-browser dismissible checklist with membership/first-match progress; Help page; shared help/legal/install footer; privacy and terms links at signup. Demo feedback links stay in the demo.

Validation: production build, TypeScript, lint, reliability regressions and added notification classification tests passed. Browser checks covered phone widths 390 and 320, desktop rating details, inbox filters, club search, announcement preview, checklist, Help and signup links. A ratings-summary style collision found during mobile inspection was corrected and rechecked.

No migrations, auth configuration changes, announcement publication or production record edits were required. Actual iPhone/Android installed-mode and dark-mode device checks remain.

Production: https://rallytt.net

Cloudflare version: `b455e4ef-50b0-4634-a78a-49c9b12c8b72`

Local screenshot: `.local-backups/screenshots/polish-inbox.png` (ignored by Git).
