# Rally site review — October 6, 2026

Recommendation: dedicate the next release to readability, navigation consistency, and shorter workflows. Rally has enough functionality that making existing features easier to find and use will now have a larger effect than adding more controls to the same pages.

## Review coverage

Reviewed production pages and sample workflows in the browser at desktop and 390 × 844 mobile viewport sizes: player and organizer dashboards; players; matches and the record-match form; clubs and club management; public player statistics; tournament directory, public double-elimination page and management page; inbox; records and requests; feedback; account settings; announcements; login and signup presentation; installation; ratings explanation. Reviewed public homepage, offline, privacy, terms, shared navigation and styling in source as well.

This was a read-only product review. No matches, requests, announcements or accounts were created, approved or deleted. No preferences were changed. The signed-in session redirects the root homepage to the clubhouse, so the signed-out landing page was reviewed in source rather than visually in this browser. Real iPhone/Android installation, background session retention, email delivery, dark-mode rendering, photo gestures and live event updates still require separate device/workflow checks. Browser viewport inspection does not reproduce iOS standalone safe areas or keyboard behavior.

## Highest-priority findings

### 1. Make player graphs readable and scale them to actual results

Confirmed in browser and source. A player rated 392 currently gets a rating chart spanning 300–1,050. The chart still forces the old 1,000 reference into the bounds (`app/player-performance.tsx:12`). Labels are very small on mobile; a one-match chart repeats the same date at both ends and gives little useful visual context.

Recommendations:
- Use actual values with sensible padding and a minimum range. Keep both compared players on the same scale and make the axis clear.
- Show an appropriate one-match state, with the current rating and a message that a trend needs more results.
- Size labels for the rendered phone chart, and allow tapping a point to see its date, opponent, result and rating change. Keep the accessible match selector as an alternative.
- Add date-range controls and, later, an optional recent win-rate view alongside the current cumulative view. Clearly distinguish the two.

Acceptance: a 400-level player’s small rating changes are legible; two players share an honest axis; one-point and empty states are intentional.

### 2. Give mobile tournaments a readable match view alongside the bracket

Confirmed in the sample double-elimination management page. “Fit bracket” reduces a four-player draw to roughly 18% on mobile; names and scores become unreadable. Fit is useful as a map, but not as the main way to follow matches. Tournament metadata, deletion, sharing and winner information also take considerable vertical space before the bracket.

Recommendations:
- Add a mobile Matches / Bracket switch. Matches should show ready, playing/assigned and completed matches in readable cards.
- Offer “Find player” and “Jump to my match”; highlight the selected card and its path in the draw.
- Use readable initial zoom, with an explicit overview/minimap mode for the complete draw.
- Move deletion into a clearly labeled organizer settings/danger section.
- Consolidate public-page and sharing links into a compact action row; keep registration/check-in/status prominent when relevant.
- Show the last successful refresh and a visible reconnecting/error state, so spectators understand whether information is current.

Acceptance: users can find a match without zooming through the entire draw; overview mode remains available; mobile actions do not bury the draw.

### 3. Stop the signed-in header flashing “Sign in” during navigation

Observed across account, profiles, clubs and tournament pages: initial content shows “Sign in,” then the account name appears after session loading. This is a visual loading issue, not evidence that the session was actually lost. It nevertheless resembles the earlier logout problem to a user.

Recommendation: preserve known account state across navigation or reserve the account area with a neutral loading placeholder until authentication is resolved. Keep header dimensions stable.

Acceptance: moving between signed-in pages never briefly suggests the user has signed out.

### 4. Consolidate navigation and clarify public browsing

Confirmed menu contains both “Feedback” and “Request a feature / report a bug.” Account actions include both “Edit profile” and “Account settings.” “Home” sends signed-in users back to the clubhouse, as intended by the current routing, but does not give them a clear route to browse the public player/match directory. Clubs also has a public directory destination and a clubhouse tab destination.

Recommendation: keep one feedback destination; group profile editing under account settings; distinguish public exploration from member activity with clear labels and destinations. Preserve the requested signed-in default, while adding a separate public browse route if public-directory access is desired for members. Use consistent back links and active navigation indicators.

Acceptance: every menu item has a distinct purpose, and the same label leads to the same type of page.

### 5. Make the demo consistent with the real product

Confirmed: the clubhouse uses Alex Morgan as the sample account, while sample records/account pages can display the real signed-in account in the header. Sample account settings also omit the real profile photo, username, bio and Rally ID section. Sample inbox has ten updates but no timestamps.

Recommendation: use one consistent sample identity and shared page components throughout. Include sample profile editing, club branding and announcements, with an obvious indication that changes affect only sample data. Keep dated events useful as the calendar advances. Ensure every advertised feature can be explored in the demo.

Acceptance: users cannot confuse sample actions with real-account actions, and the demo accurately shows current features.

## Next-priority improvements

| Area | Finding | Recommended improvement |
|---|---|---|
| Club detail | About, requests, management, season rules, standings, members and tournaments form a long page. Role and initial-rating controls add substantial roster density. | Add About / Members / Competition / Announcements tabs or anchored sections. Show organizer controls in a distinct management area. Put rating estimates and role changes behind a member action menu. |
| Mobile standings | Player-directory rows use small secondary text; mobile season standings show place, player and rating while match count and W–L are absent. | Define intentional mobile rows/cards, with expandable statistics. Keep match-count/provisional information easy to see rather than hiding columns generically. |
| Match history | Filters currently cover club and result status; browsing old results requires paging through matches. “Void result” appears on each eligible confirmed match. | Add searchable player, date range and tournament filters; offer “My matches.” Put history, correction/report and void actions in a contextual menu, with permission-specific labels. |
| Player detail | Clubhouse player details open a long slideout containing graphs, rating history, head-to-head and memberships; public profiles use a separate full-page experience. | Use one full player page with Summary / Progress / Matches / Head-to-head sections, while preserving the originating club/filter context. Add search to long opponent lists. |
| Account settings | The ownership-transfer section is prominent above notifications and appearance, even when someone only wants to update their profile. Photo actions wrap awkwardly on a narrow screen. | Keep profile and sign-in controls first. Place optional ownership transfer near deletion in a collapsed “Club ownership” section. Use one photo-action menu or a consistent upload/remove layout. Keep appearance immediately above deletion as requested. |
| Inbox | Repeated Inbox headings; many generic “Open” actions; sample events have no timestamps; long unread list. | Add All / Unread / Action needed filters, dates where reliable event times exist, grouped activity and descriptive actions such as “Verify match.” Separate historical notices from outstanding tasks. |
| Announcements | Repeated Announcements headings and a very wide desktop composer. Publishing requires opening a separate administrative surface. | Use a comfortable form width and one heading. Show audience and preview clearly. Consider scheduled posts, expiration dates and an archive after the core presentation is polished. |
| Public clubs | Large cards and no search/location filter on the current public directory. | Add name/location search when club volume warrants it, consistent banner proportions, and concise meeting/membership information. |
| Ratings guide | Accurate detail is presented as a long technical document before readers get a short practical explanation. | Put a brief summary first: provisional 400, stronger opponents matter, tournament weights, repeat-opponent limit and aging. Include two worked examples; retain detailed rules in expandable sections. |
| Onboarding and help | Signup has no visible privacy/terms links in its form. Legal links appear on legal pages, but are not provided by the shared layout. | Add concise privacy/terms links at signup and a consistent support/legal footer on appropriate public pages. Add a first-use checklist: profile, join/create club, first match, install. |
| Installation | Android instructions always precede iPhone instructions, and the iPhone wording assumes the Share button is at the bottom. | Prioritize the device’s instructions with an accessible platform switch, and use illustrations/text that accommodate different browser layouts. Hide redundant installation prompts for installed use. |
| Feedback | Basic text fields work, but reports rely on users manually describing environment and page. | Prefill the current page when opened contextually; add structured reproduction/expected/actual fields for bugs and an optional screenshot attachment with an explicit upload action. |

## Suggested release order

1. **Readability and consistency:** chart bounds and mobile labels, readable tournament match view, authentication loading state, menu cleanup, demo parity, purposeful mobile standings.
2. **Shorter everyday workflows:** club sections, unified player pages, match search, account organization, inbox filtering and clearer actions.
3. **Onboarding and event polish:** first-use checklist, device-aware install help, rating examples, announcement scheduling/expiration and better bug reports.

Use shared buttons, search pickers, action menus, spacing, empty/loading states and page headers as each area is updated. The goal is consistent behavior and visual rhythm across Rally, rather than more one-off CSS fixes.

Before considering the polish release complete, check real iPhone standalone and Android installed modes, keyboard-open layouts, long player/club names, no-data and large-data cases, dark mode, and player/organizer/public permissions. Those checks should be a bounded release checklist, not an excuse to postpone the concrete fixes above.
