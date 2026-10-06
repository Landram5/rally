# Rally product review — October 6, 2026

This review covers the club-page, account-layout, standings and profile-crop changes. Automated checks use SQLite fixtures and pure crop geometry; browser checks use synthetic demo data and anonymous live pages. It does not establish real iPhone Home Screen behavior.

## Findings addressed during review

- Owner tools made the new club page busy. Management now starts collapsed so the bio and member roster are easier to scan. Role selection stays beside each member for owners.
- The new club page showed Sign in alongside an authenticated account menu. The menu now replaces Sign in for signed-in visitors.
- Appearance inherited zero horizontal padding from generic account sections. Explicit padding now matches the other cards.
- Club edit labels were ambiguous for exact label lookup when wrapping populated textareas. Explicit input IDs and label associations now work.
- The account endpoint's 4 KiB request limit would reject cropped JPEGs. Profile saves now allow the existing photo-sized cap; other account actions keep their smaller limit. Tests verify both photo writes and unchanged oversized-action rejection.
- The first public club implementation serialized the full public clubhouse graph. Initial page props now include only the selected club and its related records.

## Remaining limits

- Real-device verification is the first release priority: photo picker, touch drag, notch spacing, keyboard-open forms and persistent Home Screen sessions. Desktop mobile viewports cannot validate all of these.
- Club pages have a complete roster without member search or pagination. As clubs grow, that will become slow to scan. Standings expansion also reveals all remaining players rather than paging them.
- The public club route still obtains data through the broad clubhouse read service before filtering it. Dedicated per-club database queries and pagination are worthwhile when usage grows.
- The cropper accepts JPG, PNG and WebP, exports a 320-pixel JPEG and offers zoom/pan. It does not have rotation or recropping from an original image stored on the server. Original files are not retained.
- Appearance remains a browser preference; it does not synchronize across devices.
- The club page links to tournament details; a clearer registration/join workflow and event scheduling would help users know what they can play next.

## Brainstorm, in suggested order

1. Member search and role filters on club pages; load more after a modest roster page size. This directly addresses growing clubs.
2. Upcoming event cards with registration status, entry actions and a clear return to the club. Add venue, meeting schedule and a club contact link if owners need them.
3. Match notifications: a pending result, verification request, tournament start or next fixture. Start with an in-app inbox before email/push preferences.
4. Player rating history: recent changes, opponent strength and tournament weight, linked to the existing explanation.
5. Rotation/reset in photo cropping and a larger original-image workflow if users need repeated edits.

## Google sign-in branding

Yes: Supabase officially supports auth.rallytt.net as a custom auth domain. It requires a paid Supabase plan and its custom-domain add-on (currently USD 10/month), Cloudflare CNAME/TXT verification, and an additional Google OAuth callback before activation. Google's app branding can separately display the Rally name/logo after verification. The website's existing sign-in start and final return already use rallytt.net; the provider intermediary is what shows the Supabase domain. No billing or auth changes were made for this inquiry.

- [Supabase custom domains](https://supabase.com/docs/guides/platform/custom-domains)
- [Google sign-in branding guidance](https://supabase.com/docs/guides/auth/social-login/auth-google#setup-consent-screen-branding)
- [Supabase pricing](https://supabase.com/pricing)

## Follow-up review: member discovery, registration and inbox

The first three brainstorm items are now implemented: searchable club rosters with role filters and load-more, actionable upcoming tournament cards, and an in-app inbox. These supersede the earlier roster-search and registration limitations.

The inbox is current activity rather than a full notification history. Read receipts synchronize through the account database, but new activity loads on navigation/reload or after an action; automatic refresh, email and push preferences are future improvements. Verification links open Matches and tournament links open the relevant event. A direct highlight for the specific pending result would help clubs with many requests. Club rosters page their rendered list, while the underlying data service still loads the complete authorized graph.

Next improvements to discuss:
1. Player rating history explaining each change and opponent/tournament influence.
2. Club venue, meeting schedule and contact fields; tournament check-in and match time/court assignments.
3. Automatic inbox refresh and optional notification delivery preferences.
4. Database-level pagination as clubs grow.

Real iPhone Home Screen checks remain the next verification priority, particularly touch cropping, keyboard-open forms, safe areas and session persistence. Browser viewport checks cannot establish those behaviors.

## Follow-up: rating explanations and automatic refresh

Rating history now appears in the clubhouse player panel. Review reduced the first implementation's density: the latest match starts expanded, older explanations expand on tap, and the initial list is limited to 10. Original points and today's aged contribution are separately labeled; pre-match values are historical replay values and can change when older records are corrected or voided. The rating rules remain unchanged.

The Inbox now refreshes visible activity every 30 seconds and on focus/resume, with a manual Refresh control. Polling pauses during editing; stale responses cannot replace a newer mutation. It remains an in-app current-activity feed with no email or push delivery. Rating history on public profiles would need a dedicated public rating scope to avoid exposing private club data or producing misleading totals from only one player's matches. Database pagination and real iPhone Home Screen verification remain priorities.

Suggested next product work: club venue/contact/meeting schedules; tournament check-in, match time and court assignments; notification delivery preferences.

## Follow-up: club logistics, tournament operations and scale

The user reports the iPhone experience looks good for now, so the remaining proposed improvements are implemented: public club venue/schedule/contact/join details; event deadlines/start times/check-in; per-fixture court/time assignments; exact-match verification links and verifier names; a scoped rating chart; and database pagination for members, matches and events. These supersede the earlier scheduling, roster-pagination and club-read limitations. Email/push and divisions were not part of this round.

Review fixes: date controls now submit the displayed native value and preserve it when another field changes; expired events consistently say registration closed; rating-scope labels are explicitly associated; waiting fixtures include round/third-place labels; paging returns to the start of the list; club refresh stays scoped after a mutation. An authenticated real-club check caught a server serialization error that the demo did not exercise. Safe aggregation maps are now converted to plain objects at the Server Component boundary, with regression coverage and a successful production recheck.

The design keeps organizer forms collapsed, stores times as UTC and labels displayed local times. Club contact information is public and labeled accordingly in the editor. No production club details, tournaments, matches or check-in records were fabricated for testing. Demo edits were reset after verification.

Remaining product decisions, in suggested order:

1. Pilot a real club tournament with actual organizers and players. Check deadline handling, attendance, table assignments, scoring and verification together. Check-in currently records attendance; it does not automatically exclude unchecked players from the draw.
2. Cache rating/standings aggregates and paginate the lightweight player catalog if usage grows. Database pages reduce transferred history, but the summary/rating replay still reads all authorized history server-side.
3. Add organizer audit-history viewing and a clear correction/dispute workflow. Audit data already exists; a readable interface would help resolve disagreements.
4. Guest account claims, with ownership checks so existing guest results can follow a new account safely.
5. Optional notification delivery preferences before adding email/push. The current Inbox remains current activity rather than a permanent notification archive.

The rating chart shows up to 20 match updates plus today's rating. Aging is reflected at the next plotted update rather than as a continuous daily curve. Appearance remains local to each browser, and original photo files are not retained for later recropping.
