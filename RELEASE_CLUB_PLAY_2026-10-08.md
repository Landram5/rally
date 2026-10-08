# Club play and rating features — prepared, not deployed

Branches (stacked, each includes the one before): `claude/rating-insights` → `claude/public-leaderboard` → `claude/club-play`. Production version: none. Rating calculations are unchanged; everything below reads the existing model.

## Rating and sharing (display only)
- Rating change (+8.0 / −6.0) on member match rows, public player match cards, public tournament players and a new public result page `/matches/[id]`.
- Players tab: season ranking period and an established-only toggle. Public Players list is a ranked leaderboard (club filter, sort, established filter; shareable URLs).
- Rating chart markers for tournament matches and upset wins (beating a player rated 100+ higher); streak, best-rating and upset badges on profiles.
- `/head-to-head/A/B` page, generated 1200×630 preview images for players, matches, tournaments and head-to-head (`/og/...`), canonical and social metadata. Preview images use `next/og`; verify the image URLs after the first deploy.
- Record-match sheet shows what is at stake for either result (model replay with a hypothetical result; a test proves it equals the recorded change).

## Club play
- Venue display `/tournaments/[id]/display`: full-screen TV board (now playing, up next, draw or standings, latest results), 10-second refresh, full-screen toggle.
- Open play (members at the club who want a game): table `open_play`, `/api/open-play`, panel in the club Sessions tab. Entries last 15 minutes to 6 hours, only active members see them.
- New formats: **Swiss** (fixed rounds, pairings generated as each round completes, no rematches, one bye per player at most) and **Round-robin groups** (snake-dealt by rating so groups have similar strength, group winners; no knockout stage yet). Swiss resets are blocked while later rounds have results.

## Deployment notes
- **Migration `0023_open_play.sql` is new.** Export production D1, apply it, then merge. Applied to local D1 only. No other migration.
- Swiss schedules only the current round for table estimates; later rounds do not exist until results are recorded.
- Support address is centralized in `lib/support.ts`; still the Gmail address until a Rally address is confirmed working.
- Verification still needed on a real device: venue display on a TV browser, open play with two accounts, preview images unfurling in iMessage/WhatsApp.
