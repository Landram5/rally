# Codex rollout handoff — 2026-10-07 — awaiting Turnstile setup

- Adam explicitly requested merging and pushing live. Production D1 exported to ignored `.local-backups/rally-before-operations-2026-10-07.sql` (313,966 bytes). Migrations 0020, 0021 and 0022 applied remotely; migration list reports none pending. Live database-backed Clubs page still loads in the browser. Non-browser HTTP probes receive Cloudflare 403, so do not confuse those with a broken app.
- Full reliability, lint, TypeScript and build rerun successfully before rollout. No source changes since tested tournament commit 616b404.
- No PR merged and no application deployment performed. PR #2 marked ready; #3–#5 remain draft. Main remains 056583f; current production Worker version was b5336205-e770-46ca-a578-6f3e87215c4e before attempted configuration.
- Blocking configuration: Worker secret names list contains only RALLY_ADMIN_EMAILS and three Supabase secrets. No TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY: deploying new forms now would block email authentication and feedback. User asked to configure securely; do not put secrets in chat. Cloudflare dashboard tab is at login. Supabase CAPTCHA activation must immediately follow new-form rollout, never precede it.
- Email provider and NOTIFICATION_FROM/RESEND_API_KEY are absent. VAPID keys also absent. Attempted generating push keys directly into Wrangler secret bulk (no file/key output), but Cloudflare rejected the entire upload with 10214 because its latest preview version is not the deployed version. No keys were saved. Do not deploy latest preview merely to get around this. Versioned secret setup must be coordinated with the approved main build.
- Next: user completes Cloudflare login/Turnstile setup; verify required secret names, coordinate Supabase activation; merge #2 to main, retarget/merge #3, #4, #5 to main sequentially with expected heads; observe Workers Builds and verify live endpoints. Never pnpm deploy or local Wrangler deploy. Email/push must not be reported active until provider keys and actual delivery are checked.
- Existing CLAUDE_HANDOFF.md untouched. No doubles or Claude UI ownership changes.

---

# Codex handoff — 2026-10-07 — tournament operations

- Branch: `codex/tournament-operations`, stacked on sessions PR #4. Owns tournament management/registration/service/scheduling, migration 0022 and checks. No leaderboard, demo source, rating display, sharing cards or global CSS edits.
- Added: tournament-specific scorekeeper assignment to active account-holding host members. Played results only; no forfeits, resets, scheduling or organizing. Server checks membership/assignment again inside the write transaction. Membership removal and account deletion revoke assignments.
- Scheduling: 1–64 tables, 5–120 minutes per match, ready/waiting fixtures, bracket dependencies, known-player conflicts, estimated finish including a possible reset final. Greedy estimates, not predictions. Rebuild after delays. Actual called matches reserve table/players and remain assigned on rebuild; scoring releases the call. Estimates do not generate email/push call-ups.
- Tournament waitlist: FIFO offers reserve capacity; player (or organizer confirming attendance) claims by deadline. Default 24h, configurable 5–1,440 minutes, capped at registration deadline. Expired/ineligible offers are removed by existing five-minute cron and next eligible player offered. Open offers block starting until resolved or registration closes. Inbox shows offer/deadline; external delivery remains the three requested event types.
- Migration: 0022 applied to local D1 only. Export plus explicit owner approval required before production application. Do not deploy or merge prematurely.
- Validation: full reliability, lint, TypeScript and final build passed. New native-SQLite tests check role restrictions, revocation between preflight/write, table/player conflicts, dependencies, reset-final estimate, called locks, FIFO reservations, deadline race rollback and next offer after expiry. Removing the scorekeeper forfeit restriction failed its mutation check; restored suite passes. Local built-Worker UI fixture at 375px has no horizontal overflow and schedule inputs fit. Authentication still enforced; fixture removed. Physical-device and signed-in browser flows remain unchecked. Temporary fixture absent from final build; claim-window field uses existing logistics input layout. Final check results recorded in PR.
- Release notes: RELEASE_TOURNAMENT_OPERATIONS_2026-10-07.md. No doubles. Production CAPTCHA approval, sender choice/secure provider and VAPID configuration remain pending. Notification scan throughput limit remains documented in its release notes.
- Preexisting untracked CLAUDE_HANDOFF.md untouched. All PRs remain draft; production unchanged.

---

# Codex handoff — 2026-10-07 — recurring sessions

- Branch: `codex/sessions`, stacked on notifications PR #3. Owns session UI/service, weekly generation, migration 0021 and session checks. No leaderboard, demo source, rating display, sharing card or global CSS edits.
- Added: weekly schedules in creator/device time zone, rolling eight-week horizon, skip date, stop future recurrence; per-date edits. Going/Maybe/Not going, one guest, FIFO party waitlist and database-triggered automatic promotion. Removed memberships/deleted profiles clear reservations so reactivation cannot overfill capacity.
- Migration: 0021 applied locally only; export plus owner approval before production application. Do not merge/deploy prematurely.
- Checked: isolated session suite and local D1 migration pass. Test fixture used actual UI code with sample state on localhost: width 375 = scroll width 375; datetime inputs both 299px within page. API still returned sign-in requirement. Fixture removed before final build. Authenticated browser and physical-device flows remain unchecked. Full reliability, lint, build and TypeScript pass. A mutation ignoring existing guests failed the added capacity check; restored suite passes.
- Weekly edit behavior: edits apply to one occurrence, not the saved weekly template. Stop/recreate to change the whole pattern. DST overlap picks earlier instant; gap shifts forward. Cron grows future dates. Each date requires its own RSVP.
- Next: tournament scorekeepers, table-count scheduling/ETA, waitlist offers with claim deadline. Doubles remains deferred.
- Production CAPTCHA approval and notification provider setup still await Adam. Preexisting CLAUDE_HANDOFF.md untouched.

---

# Codex handoff — 2026-10-07 — notifications

- Branch: `codex/notifications`, stacked on safety PR #2. Owns notification preferences/delivery/device API, service worker push handlers and sign-out device cleanup. Claude's leaderboard, demo sources, rating displays and sharing cards remain untouched.
- Added: email (Resend provisional provider) and encrypted Web Push from three existing inbox events. Default-off channel preferences; server-verified opt-ins; verified Auth email; current-device permission controls; persistent dedup/retries; lease against overlapping scans; deletion cleanup. No real delivery or production configuration.
- Migration: `0020_notification_delivery.sql` applied locally only. Production requires owner go-ahead plus export before dependent merge.
- Limits: five subscribed accounts per scan, three pending deliveries each; five devices per account; five retries within 23 hours. Scans run after successful Rally/session writes and each five-minute cron. Busy-event timing is not guaranteed; event-targeted queueing remains a delivery limitation.
- Checked: new isolated delivery suite, full reliability, lint, build and TypeScript passed. Read-state mutation failed as expected; restored suite passed. Local demo account renders/saves channel opt-ins, mobile width 375 = scroll width 375. Anonymous local push API returns 401. Physical-device delivery, signed-in push permission and provider integration still unchecked.
- Rollout: read RELEASE_NOTIFICATIONS_2026-10-07.md. Email provider choice and coordinated CAPTCHA production approval are pending from Adam. Sender domain/API key and VAPID secure setup pending. Do not merge this branch until migration/configuration/UI review are coordinated.
- Next: sessions (weekly/skip, maybe/guest, capacity waitlist), then tournament operations. No doubles. Do not deploy from this checkout; main merges deploy via Workers Builds.
- Preexisting untracked CLAUDE_HANDOFF.md remains untouched.

---

# Codex handoff — 2026-10-07 — safety

- Branch: `codex/safety`, based on `main` at `056583f`. Scope: write limits, Turnstile, private club CSV exports and security dependency patches. No doubles.

- Ownership: Codex owns safety/auth/export files in this PR. Claude owns public leaderboard, demo fixes, rating display, sharing cards and `app/player-performance.tsx`; those files and `app/globals.css` were untouched. `app/api/rally/route.ts` changes only its POST path. `app/club-page.tsx` changes only the management export control/import.

- Rate limits: Cloudflare native bindings, 500 ordinary writes/IP/minute, 10 auth writes/IP/minute and 60 authenticated writes/account/minute, shared across Rally/account/sessions/announcements. Limits are approximate per Cloudflare location, not global quotas. Export downloads share the account limit. Outages deny writes. No D1 migration.

- Turnstile: widget on email signup/signin/reset and real feedback. Auth forwards the single-use token to Supabase. Enable its Turnstile CAPTCHA only after the new Auth forms are live, during an approved coordinated rollout; enabling it against old forms would block password auth. Feedback validates with Siteverify, expected hostname and `feedback` action. Never validate Auth tokens twice. Missing widget configuration fails closed. Google OAuth remains unchanged.

- CSV: `/api/clubs/:id/export?kind=roster|results|ratings`; only active owner/admin of that club, rechecked server-side. Board members excluded. Private/no-store; no email/Auth IDs; CSV formula escaping; current shared rating engine. Results include pending/voided statuses but exclude deleted tournaments; ratings use confirmed results and active roster.

- Validation: reliability, lint, build, TypeScript pass. New safety suite covers roles/revocation/club isolation, rating parity, CSV injection, CAPTCHA failures and Auth token forwarding, limiter denial/outages. High/critical dependency audit now clean; two low/moderate findings remain. Next 16.3.8; patched browserslist/source-map-js and Miniflare sharp override.

- Localhost: built Worker served locally on 5173 with `wrangler dev --config dist/server/wrangler.json --local --host localhost`; public dummy site key supplied only via CLI. Widget rendered successfully on signup/signin/reset; mobile page width equals scroll width (375px). Malformed Auth body returned 400, then native limit 429. Anonymous CSV download returned 401. No accounts created or emails sent. Browser testing caught broken client navigation in Vinext beta. Updated to stable Vinext 1.0.0 / RSC plugin 0.5.34 and added the required Suspense boundary to the login page. Privacy navigation and return to sign-in were then checked successfully. Physical iPhone/Android and live provider rejection remain unchecked.

- Merge blockers: configure managed Turnstile production site key + server secret and coordinate Supabase Auth CAPTCHA activation with the new forms. Review UI with Adam first; never enable provider CAPTCHA against the old forms. This changes production Auth settings, so requires Adam's go-ahead under AGENTS. Do not use `pnpm deploy` or local `wrangler deploy`; main merges deploy through Workers Builds.

- Next: tell Adam the email-then-push notification plan before task 2. Inbox remains source of truth; respect event preferences and channel opt-in; durable deduplication/retries; Home Screen permission requires user gesture. Then sessions, then tournament operations. Every PR needs full reliability/lint/build before merge; migration export + explicit approval before any production D1 application.

- Preexisting untracked `CLAUDE_HANDOFF.md` is not part of this PR.

---

# Handoff log

Newest entry first. Each agent (Codex or Claude) adds an entry when it stops. Keep it short and factual.

Template:

```

## YYYY-MM-DD — <agent> — <topic>

- Branch/commit:

- Changed:

- Verified (commands run, results):

- Not done / open questions:

- Don't touch:

```

## 2026-10-07 — Claude — coding rules

- Branch/commit: `claude/agent-setup`

- Changed: added Coding Rules and Suggestions sections to `AGENTS.md` (minimum code, ask before suggestions with an Accept all option, urgent issues flagged immediately). Workflow Constraints in `AGENTS.md` and `CLAUDE.md` now require one full run (`pnpm test:reliability`, lint, build) before merging to `main`.

- Suggestions waiting for the owner: none yet. If the owner is away, write suggestions here.

## 2026-10-07 — Claude — Cloudflare connected to GitHub

- Branch/commit: `claude/agent-setup`

- Changed: Cloudflare Workers Builds is now connected to `Landram5/rally` (branch `main`) with build `pnpm run build` and deploy `npx wrangler deploy --config dist/server/wrangler.json`. Merging to `main` now deploys. `AGENTS.md` / `CLAUDE.md` updated to match (this replaces the earlier "Codex is the only deployer" note below).

- Not yet verified: no build has run. The first merge to `main` will be the first build; check Cloudflare > Worker > Deployments, and note the version ID in the release note. If it fails (for example pnpm or env vars on the build machine), Codex's `pnpm deploy` from the PC remains the fallback.

- Pending pull requests for the owner to merge: `claude/agent-setup` (agent docs) and `claude/match-header-logo` (tab and Home Screen icons; release note `RELEASE_LOGO_MATCH_2026-10-07.md`). Merging each will trigger a production deploy.

- Don't touch: `.dev.vars`, production D1, Supabase settings without the owner's go-ahead.

## 2026-10-07 — Claude — deploy rule and pending branches

- Branch/commit: `claude/agent-setup`

- Changed: `AGENTS.md` and `CLAUDE.md` now say Codex is the only deployer, and must `git pull` main before each deploy.

- Waiting for the owner to merge: `claude/agent-setup` (agent docs) and `claude/match-header-logo` (tab and Home Screen icons now match the header logo; release note `RELEASE_LOGO_MATCH_2026-10-07.md`).

- Codex, please: after the owner merges `claude/match-header-logo`, pull `main` and include it in your next deploy. Existing Home Screen installs keep the old icon until re-added.

- Don't touch: `.dev.vars`, production D1, Supabase settings without the owner's go-ahead.

## 2026-10-07 — Claude — agent setup and service check

- Branch/commit: `claude/agent-setup`

- Changed: added `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`. No application code changed.

- Claude now has connectors for GitHub (push access to this repo), Supabase and Cloudflare. All production checks below were read-only.

- Production state (checked 2026-10-07 ~19:50 UTC):

  - Cloudflare Worker `rally-table-tennis`, last modified 2026-10-07 19:02 UTC. Deploys are run by the owner from their PC with Wrangler (`pnpm deploy`); merging to GitHub does not deploy.

  - D1 `rally-table-tennis` (id in `wrangler.jsonc`): 36 tables, all 20 migrations (0000–0019) applied, latest `0019_unaffiliated_play` on 2026-10-07 17:40 UTC. Nothing pending.

  - Supabase project "Rally" (ref `jzkimmldjarjhlxunfbu`, us-east-1, Postgres 17), healthy; used for Auth only.

- Open items:

  - Supabase security advisor: leaked-password protection is disabled. Owner can enable it in Authentication > Password security.

  - Auth redirect allow-list and Site URL could not be read through the connector; confirm in the Supabase dashboard (Authentication > URL Configuration).

  - Real-iPhone checks listed in `CONSOLIDATION.md` are still open.

- Don't touch: `.dev.vars`, production D1, Supabase settings without the owner's go-ahead.

---

# Handoff log

Newest entry first. Each agent (Codex or Claude) adds an entry when it stops. Keep it short and factual.

Template:

```
## YYYY-MM-DD — <agent> — <topic>
- Branch/commit:
- Changed:
- Verified (commands run, results):
- Not done / open questions:
- Don't touch:
```

## 2026-10-07 — Claude — coding rules
- Branch/commit: `claude/agent-setup`
- Changed: added Coding Rules and Suggestions sections to `AGENTS.md` (minimum code, ask before suggestions with an Accept all option, urgent issues flagged immediately). Workflow Constraints in `AGENTS.md` and `CLAUDE.md` now require one full run (`pnpm test:reliability`, lint, build) before merging to `main`.
- Suggestions waiting for the owner: none yet. If the owner is away, write suggestions here.

## 2026-10-07 — Claude — Cloudflare connected to GitHub
- Branch/commit: `claude/agent-setup`
- Changed: Cloudflare Workers Builds is now connected to `Landram5/rally` (branch `main`) with build `pnpm run build` and deploy `npx wrangler deploy --config dist/server/wrangler.json`. Merging to `main` now deploys. `AGENTS.md` / `CLAUDE.md` updated to match (this replaces the earlier "Codex is the only deployer" note below).
- Not yet verified: no build has run. The first merge to `main` will be the first build; check Cloudflare > Worker > Deployments, and note the version ID in the release note. If it fails (for example pnpm or env vars on the build machine), Codex's `pnpm deploy` from the PC remains the fallback.
- Pending pull requests for the owner to merge: `claude/agent-setup` (agent docs) and `claude/match-header-logo` (tab and Home Screen icons; release note `RELEASE_LOGO_MATCH_2026-10-07.md`). Merging each will trigger a production deploy.
- Don't touch: `.dev.vars`, production D1, Supabase settings without the owner's go-ahead.

## 2026-10-07 — Claude — deploy rule and pending branches
- Branch/commit: `claude/agent-setup`
- Changed: `AGENTS.md` and `CLAUDE.md` now say Codex is the only deployer, and must `git pull` main before each deploy.
- Waiting for the owner to merge: `claude/agent-setup` (agent docs) and `claude/match-header-logo` (tab and Home Screen icons now match the header logo; release note `RELEASE_LOGO_MATCH_2026-10-07.md`).
- Codex, please: after the owner merges `claude/match-header-logo`, pull `main` and include it in your next deploy. Existing Home Screen installs keep the old icon until re-added.
- Don't touch: `.dev.vars`, production D1, Supabase settings without the owner's go-ahead.

## 2026-10-07 — Claude — agent setup and service check
- Branch/commit: `claude/agent-setup`
- Changed: added `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`. No application code changed.
- Claude now has connectors for GitHub (push access to this repo), Supabase and Cloudflare. All production checks below were read-only.
- Production state (checked 2026-10-07 ~19:50 UTC):
  - Cloudflare Worker `rally-table-tennis`, last modified 2026-10-07 19:02 UTC. Deploys are run by the owner from their PC with Wrangler (`pnpm deploy`); merging to GitHub does not deploy.
  - D1 `rally-table-tennis` (id in `wrangler.jsonc`): 36 tables, all 20 migrations (0000–0019) applied, latest `0019_unaffiliated_play` on 2026-10-07 17:40 UTC. Nothing pending.
  - Supabase project "Rally" (ref `jzkimmldjarjhlxunfbu`, us-east-1, Postgres 17), healthy; used for Auth only.
- Open items:
  - Supabase security advisor: leaked-password protection is disabled. Owner can enable it in Authentication > Password security.
  - Auth redirect allow-list and Site URL could not be read through the connector; confirm in the Supabase dashboard (Authentication > URL Configuration).
  - Real-iPhone checks listed in `CONSOLIDATION.md` are still open.
- Don't touch: `.dev.vars`, production D1, Supabase settings without the owner's go-ahead.

Review verification: temporarily granting board export access made the safety suite fail; restoring owner/admin-only access made it pass.
