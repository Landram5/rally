# Native app API (iOS)

Status: first step. Only authentication is changed for native clients; no response shape changed.

## Authentication

- Sign in with Supabase directly from the app (Supabase Swift SDK, same project as the website). Send the access token on every request: `Authorization: Bearer <access token>`.
- A request with a Bearer header is authenticated by that token alone. A bad or expired token returns 401 and never falls back to cookies. The app refreshes the token with Supabase and retries.
- Bearer requests skip the same-origin check (`allowedOrigin` in `lib/auth-rules.ts`). Browsers never attach an Authorization header cross-site, so this does not weaken cookie requests, which still need a matching `Origin`.
- `/api/auth/*` (password, sign-out, reset, update-password) stay web-only and cookie-based. Native sign-in goes through Supabase.

## Routes that accept Bearer

`/api/rally`, `/api/sessions`, `/api/open-play`, `/api/invites`, `/api/announcements`, `/api/messages` (+ `/media`), `/api/chat` (+ `/media`, `/ws`), `/api/rooms` (+ `/media`), `/api/discord`, `/api/live-draft`, `/api/push`, and the account route in `lib/account-http.ts`.

## Data routes

- `GET /api/rally` returns the signed-in user's clubhouse (`compact=1`, `clubScope`) or one view via `?view=` (`performance`, `seasons`, `members`, `matches`, `tournaments`, `join-clubs`, `match-record`, `rating`, `stakes`, `event`).
- `POST /api/rally` is one endpoint with a JSON body `{action, ...fields}`. Known actions are the `body.action` values handled in `lib/rally-service.ts`, `lib/tournament-service.ts` and the other services (for example `record_match`, `confirm_match`, `create_tournament`, `score_fixture`, `enter_tournament`, `rsvp_session`).
- Errors are `{error: string}` with a status code.

## v1 contract (read from the code; shapes marked "unconfirmed" still need one real response to check)

General: JSON in and out. Errors are `{error: string}` with 400 (bad input), 401 (not signed in), 403 (not allowed, or origin), 409 (conflict or reused ID), 413 (too large), 415 (not JSON), 429 (rate limited: 60 writes/min per account), 503 (temporary). Bodies: `/api/rally` max 256 KB, live draft max 2 MB. All IDs the client creates must match `[A-Za-z0-9_-]{1,80}`. Dates are `YYYY-MM-DD`; timestamps are ISO 8601.

### Who am I: `GET /api/auth/session`
`{user: {displayName: string, profileId: string|null} | null}`. `profileId` is null until the player profile exists (create it with `save_profile`).

### Clubhouse: `GET /api/rally?compact=1` (optional `clubScope=<clubId>`)
401 if signed out. Top-level keys (compact mode): `me` (`{id, name, profileComplete}` or null), `signedIn`, `account` (`{email, displayName, emailVerified}`), `isSiteAdmin`, `players`, `deletedPlayers`, `clubs`, `memberships` (`{id, club_id, player_id, role, status}`), `matches` (newest 20), `tournaments` (newest 20), `entries`, `teams`, `summaries`, `eventCounts`, `notifications`, `dashboards`, `ownership`, `preferences`, `sessions`, `feedback`.
- Player: `{id, name, is_guest, is_deleted, photo_url, initial_rating, initial_rating_revision}`. `is_guest` and `is_deleted` are 0/1 integers, not booleans.
- Club fields come from `id, name, location, bio, venue, meeting_schedule, contact, joining_info, slug` plus image URLs (unconfirmed which are returned).
- Match rows follow `SavedMatch` in `lib/rally-service.ts`: `{id, club_id, a, b, games, best_of, played_on, status, submitted_by, confirmed_by, tournament_id}`. `status` is `pending`, `confirmed` or `voided`. Whether `games` arrives as a JSON string or an array is unconfirmed; the database stores it as a string like `[[11,6],[11,9]]`, so decode both ways.
- Tournaments, dashboards, notifications and sessions: unconfirmed; map them when each screen is built.
- Other views: `GET /api/rally?view=performance|rating|stakes|event|seasons|members|matches|tournaments|join-clubs|match-record` (see `app/api/rally/route.ts`).

### Record a match: `POST /api/rally`
Request: `{action:"record_match", id, clubId, a, b, date, bestOf, games:[[number,number],...]}`
- `id` is created by the app and makes the call safe to retry: the same `id` with identical data returns success again, with different data returns 409 "Submission ID already used."
- `a`, `b` are player IDs. `clubId` can be `"unaffiliated"` for two registered players with no club.
- `date` cannot be in the future. `games` must be a valid finished match for `bestOf` (play to 11, win by two); otherwise 400 with a readable message.
- Players can only submit their own matches (club admins can submit any). Both players must be active club members.
Response: `{ok:true, id, status:"pending"|"confirmed"}`. Club owners, admins and board members' results are confirmed immediately; everyone else's are `pending`.

### Confirm or void: `POST /api/rally`
`{action:"confirm_match", id}` or `{action:"void_match", id}`, response `{ok:true}`.
- Confirm: only the opponent (not the submitter) or a club admin, and only while `pending`.
- Void: a club admin, or the submitter while the match is still `pending`.
- Tournament matches (those with a `tournament_id`) return 409; they are managed through tournament actions.

### Live match draft: `/api/live-draft`
One draft per account; the newest save wins.
- `GET` returns `{draft: LiveMatchDraft | null}`.
- `PUT` with a `LiveMatchDraft` body returns `{stored: boolean}`.
- `DELETE` with `{id}` returns `{ok:true}` and only removes the draft with that `id`.
- `LiveMatchDraft`: `{version:1, owner:<profileId>, id, clubId, a, b, bestOf:1|3|5|7, date, updatedAt, swapped:boolean, state:{points:[n,n], games:[[n,n]...], complete:boolean, history:[snapshot...]}}`, where each history `snapshot` is `{points, games, complete}`. Scores are integers 0 to 999; the server rejects drafts that are not valid score states.
- The scoring rules (deuce, game and match completion, undo) are implemented in `lib/live-score.ts`; the app must apply the same rules locally.

### Register for push: `POST /api/push/native`, `DELETE /api/push/native`
(on branch `claude/native-push-devices`, stacked on this one; needs migration 0045)
- `POST {token, environment:"sandbox"|"production"}` registers this device's APNs token; `DELETE {token}` removes it. Response `{ok:true}`.
- `token` is the hex device token (64 to 200 characters, stored lowercase). Use `sandbox` for Xcode and TestFlight debug builds, `production` for App Store builds.
- At most 5 devices per account; a sixth returns 409. A token registered by a different account moves to that account. Deleting an account removes its devices.
- Sending notifications through APNs is not built yet; this only stores tokens.

## Not done yet (next steps)

1. Contract for the remaining actions (tournaments, sessions, messages, chat, profile) and the response shapes marked unconfirmed above.
2. `submit_feedback` needs a Turnstile token; native has no equivalent yet.
3. APNs delivery (sending). Device-token storage is on `claude/native-push-devices`. Needs an Apple APNs key, which Adam must create and add as a Worker secret; never paste it in chat.
4. Live-match feed for spectators, widgets and Apple Watch (today `/api/live-draft` syncs one private draft per player).
5. Sign in with Apple (branch `codex/apple-signin` is not merged).

## Verification status

- Unit-tested: `bearerToken` and `allowedOrigin` (`scripts/auth-rules.test.mjs`).
- Not yet verified: the Bearer path in `getAuthenticatedUser` against a real Supabase token, and the full reliability/lint/tsc/build run. See `HANDOFF.md`.
