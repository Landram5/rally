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

## Not built yet

1. **Doubles tournaments (phase 2).** Pairs register together (a team of two members), the existing formats run on team ids, results create `doubles_matches` with `tournament_id`. Needs: team entry model and waitlist behaviour, draw display with pair names, venue display, scoring screens, and what happens when one partner withdraws.
2. **Doubles rating display.** Profile (doubles rating, record, partners), a doubles leaderboard and a doubles rating history chart.
3. **Live scoring for doubles** and share cards; public pages for doubles matches and pairs; head-to-head for pairs.
4. **Demo support.** The sample demo does not show doubles yet.
5. **Seeding doubles events** from doubles ratings (`suggestSeeds` is singles only).

## Phase 2: doubles tournaments (built)

- 	ournaments.team_size (1 singles, 2 doubles) and doubles_teams (two players per team; database triggers keep a player on one team per event and teams out of singles events).
- Players register a team by choosing a partner (enter_team); either partner or an organizer withdraws it (emove_team); organizers can enter any team. Capacity counts teams. Draws, brackets and formats are unchanged and run on team ids.
- Seeds come from the average doubles rating of each team. Results are written to doubles_matches (never matches), corrected by reset then re-score, voided on reset or when the tournament is deleted, and counted at the tournament weight in the doubles rating.
- Account deletion keeps teams that already played (the deleted player becomes a placeholder) and withdraws teams still in registration. Guest merging treats teams like entries.
- The app reads teams as entries under their own id, so counts, names, brackets and the public pages work; players on a team get the same match-ready notices as singles players.
- Not in this phase: waitlists and check-in for doubles events, mixed-event rules, cross-club tournament weighting for doubles, doubles rating on profiles and leaderboards, doubles in the sample demo, and a doubles-specific venue-display layout.
