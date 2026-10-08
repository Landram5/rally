# Doubles

Status: **phase 1 built and tested on `claude/product-gaps`; not deployed.** Migration `0027_doubles.sql` is applied to the preview database only. Production needs an export, Adam's approval and the migration before the code ships.

## Decisions (agreed 2026-10-08)

- Doubles ratings are **separate** from singles. Singles ratings, statistics and leaderboards are never changed by a doubles result (`rating model` untouched).
- First release covers **casual matches and tournaments**. Phase 1 below is casual matches; tournaments are phase 2.

## Data model

Doubles lives in its own tables so nothing that reads `matches` can be affected.

- `doubles_matches`: side A is `a1`+`a2`, side B is `b1`+`b2`; four distinct players enforced by a CHECK. Same statuses as singles (`pending`, `confirmed`, `voided`), same retry-safe client id, same `revision` counter.
- `doubles_audit`: one row per submit, confirm and void.

## Rules (match singles unless noted)

- Club members only (or four registered players for unaffiliated play). Players may submit matches they played in; club administrators' entries are confirmed immediately.
- Confirmation comes from the **opposing side** or an administrator, never the submitter's partner.
- Players may withdraw their own pending result; only administrators void a confirmed one.

## Rating: `doubles-v1` (`lib/doubles-rating.ts`)

Replayed from every confirmed match, in date order, like singles.

- A side's strength is the average of its two players' doubles ratings. Players start at 400 (or a supplied estimate).
- Points come from the same exchange table as singles, multiplied by event weight (tournament 2x, cross-club 3x), the single-game weight and the repeat-pairing weight (same two partnerships within 30 days), then by `DOUBLES_FACTOR = 0.5`. Each player on a side receives the side's change.
- Floor of 100. Pending, voided and future results never count. Result is independent of input order.

`DOUBLES_FACTOR` is a modelling choice (doubles gives each player less evidence than singles). It is one constant if you want to change it.

## What is built (phase 1)

- Server: `lib/doubles.ts` (record, confirm, void, feed), `lib/doubles-rating.ts`, `/api/doubles` (read), actions through `/api/rally`.
- UI: a **Doubles** section under the Matches tab to record a match (two players per side), see the feed, confirm, withdraw or void. Hidden in the sample demo.
- Safety: account deletion keeps the other three players' results with a "Deleted player" placeholder; guest merging voids matches that contain both profiles and re-points the rest. Both covered by `scripts/doubles.test.mjs`.

## Phase 3: everything else (built)

- **Waitlist and check-in for teams** (migration 0029). A full event takes a waiting team (both players chosen up front). The first waiting team takes a place automatically when a team leaves or the limit goes up, in joining order, until the draw starts. There is no claim window because the team already agreed. A player can be on one team or one waiting team per event. Check-in is per team; a member or an organizer can toggle it while check-in is open.
- **Cross-club weight.** Doubles tournaments count 3x when the players come from two or more approved clubs, using the same rule as singles. The rating reads now include the tournament weight.
- **Doubles rating display.** Doubles tab > Standings (club or all clubs, established-only filter, best partnerships) and My rating (rating, record, partners, history chart). The same card shows on a club-mate's player page for signed-in viewers. Everything uses ``lib/doubles-view.ts``, which the server and the sample demo share.
- **Live scoring.** The record-a-match form can score point by point (the same tracker as singles). It can only be saved once the match is complete.
- **Public pages.** ``/doubles/<match>`` (a confirmed result) and ``/pairs/<a>/<b>`` (a pair's record together, recent results and record against other pairs), each with a share card (``/og/doubles/...``, ``/og/pair/...``). Approved clubs only, confirmed results only, and a deleted player removes the page.
- **Sample demo.** Metro has doubles results, a pending result to confirm, standings and an open doubles event (register a team, join the waitlist, check in, start and play it).

## Limits

- Live scoring covers casual doubles matches, not saving a draft across devices or the offline outbox (those exist for singles only).
- Doubles ratings are not on the public player page for signed-out visitors, and there is no public doubles leaderboard or directory listing yet.
- Pair-versus-pair is shown as a record on each pair's page; there is no dedicated head-to-head page.
- The venue display uses the team names in the existing layout.
- Mixed or open-gender rules, and doubles in the demo public pages (``/demo/...``), are not modelled.