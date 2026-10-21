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

## Not done yet (next steps)

1. Written request/response types per action, so Swift models can be generated. Today the shapes exist only in the TypeScript.
2. `submit_feedback` needs a Turnstile token; native has no equivalent yet.
3. Device-token table and APNs delivery (existing push is Web Push only).
4. Live-match feed for spectators, widgets and Apple Watch (today `/api/live-draft` syncs one private draft per player).
5. Sign in with Apple (branch `codex/apple-signin` is not merged).

## Verification status

- Unit-tested: `bearerToken` and `allowedOrigin` (`scripts/auth-rules.test.mjs`).
- Not yet verified: the Bearer path in `getAuthenticatedUser` against a real Supabase token, and the full reliability/lint/tsc/build run. See `HANDOFF.md`.
