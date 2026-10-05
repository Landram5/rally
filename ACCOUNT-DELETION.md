# Account deletion

Implemented locally on October 5, 2026. Not deployed to the live Worker. No real accounts have been deleted.

## User flow

Open **Account settings** from the signed-in clubhouse header. Users can delete an account even if they never created a player profile.

Club owners must first transfer ownership to an active member with a real Rally account who does not already own another club. Guests and pending members cannot become owners. A separate confirmation explains that the original owner cannot take ownership back themselves. The former owner remains an administrator until account deletion. Clubs and other members' accounts are never deleted by this feature.

Two deletion choices are available:

- **Keep past results as “Deleted player.”** Remove the name, sign-in linkage, memberships, public profile, future registration entries, and authored tournament audit payloads. Retain the de-identified player row so past results stay connected.
- **Remove my player history.** Also delete the original player row and its authored match audit events. Replace its identifiers with separate placeholders for each standalone match and each tournament. Preserve shared scores, draws, other players' entries and records. This removes the original player history link; it does not erase other people's results or guarantee that someone familiar with an event cannot identify a participant.

Both choices require typing `DELETE`. The authenticated server session determines the target account; the endpoint never accepts a target user ID from the client. Same-origin requests, JSON validation, and a 4 KB body limit apply.

## Reliability and security

The application data changes and a durable deletion job commit in a D1 transaction. Concurrent tournament edits or ownership changes cause the transaction to roll back. Club transfers are transactional too.

The server revokes refresh sessions globally and hard-deletes the Supabase Auth user. Rally rejects access while deletion is pending. Every clubhouse write includes a deletion check inside its database transaction so requests authenticated just before deletion cannot restore data.

Supabase outages produce HTTP 202 and a clear pending message. The Worker retries up to 25 oldest jobs every five minutes. A provider `user_not_found` result is treated as a successful idempotent retry. The completed job is removed. An identifier-only write block expires 24 hours after the initial request and is purged once deletion has finished; it protects against requests already in flight. No passwords, access tokens or email addresses are stored in these jobs.

The server-only `SUPABASE_SECRET_KEY` authorizes Auth administration. It must never be placed in browser code, the iOS project, a public environment variable or source control. Google grant revocation and future Apple token revocation are separate provider integrations; this work deletes the Supabase account. When adding Sign in with Apple, implement Apple's token revocation requirement in the deletion process too.

## Enable on the live service

Cloudflare CLI is not authenticated on this Mac, and no production administrative Supabase key was provided. To finish deployment:

1. Sign in with `pnpm exec wrangler login` from the project directory.
2. Add the server-side Supabase secret to the existing Worker with `pnpm exec wrangler secret put SUPABASE_SECRET_KEY`. Enter the key directly at the secure prompt; do not paste it into chat. Verify it belongs to the same project as `SUPABASE_URL`.
3. Apply migrations with `pnpm db:migrate:remote`. This adds `deleted_at`, deletion jobs, and transactional guard tables/triggers (`0004` and `0005`). These migrations do not delete existing accounts or matches.
4. Run `pnpm deploy`. The built Worker configuration includes the five-minute retry cron. Verify the cron appears in Cloudflare after propagation.
5. Verify with explicitly disposable staging accounts, including one with an owned club and another active member. Exercise both history options, global session removal and a provider failure/retry. Validate the real Supabase project has no additional Storage objects or custom Auth foreign keys that would prevent hard deletion.
6. Monitor pending jobs (`requested_at`, `attempts`, `last_attempt_at`) and retry-failure logs. Escalate old jobs rather than marking them complete. Additional external systems, exports, or provider backups are not erased by this application transaction.

The Home Screen app loads the hosted website, so account settings becomes available there after deployment. Native iOS distribution is outside the active release plan.

## Verification completed

- `node scripts/account-deletion.test.mjs`: real SQLite migrations, ownership checks and atomic transfer, both deletion modes, preserved shared results, revision-conflict rollback, provider failures and retry, stale-write blocking, job cleanup, missing-profile accounts, and HTTP authorization/CSRF/body validation.
- Existing Rally service, tournament engine, match rules, and auth rules tests passed.
- TypeScript check and production build passed. ESLint passed with seven existing warnings outside the new feature.
- Migrations applied successfully to local Cloudflare D1.
- Browser check against a local Worker with synthetic Auth: settings link, owner restriction, transfer confirmation, both history choices and typed confirmation.
- Local Worker HTTP integration with synthetic Auth: authenticated match write, player-history deletion, old-session rejection and deleted public profile 404. Direct D1 checks confirmed the club's new owner and the opponent's match remained intact.

Real Supabase deletion and production deployment remain unverified until configuration is available. The local mock Auth server was stopped and its temporary credentials were removed after testing; synthetic D1 records remain only in local development storage.
