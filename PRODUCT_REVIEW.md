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
