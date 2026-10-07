# Rally — agent guide

Rally (https://rallytt.net) is a table tennis club and tournament platform: Next.js on Vinext, deployed as a Cloudflare Worker, with Cloudflare D1 for data and Supabase Auth for sign-in only. This file is read by every coding agent working in the repo (Codex, Claude). `CLAUDE.md` points here.

## Stack at a glance

- **Worker:** `worker.ts`, config in `wrangler.jsonc` (routes `rallytt.net/*` and `www.rallytt.net/*`, cron every 5 minutes).
- **Database:** Cloudflare D1 (`DB` binding). Schema in `db/schema.ts`, migrations in `drizzle/` (numbered `0000`–`00NN`).
- **Auth:** Supabase Auth (Google OAuth + email/password). Only the Supabase user ID is stored in D1 (`profiles.auth_id`). Session renewal lives in `proxy.ts`.
- **Source of truth for status:** `DEVELOPMENT.md` (what exists), `ROADMAP.md` (what's next), `CONSOLIDATION.md` (deploy history, release gates), `RELEASE_*.md` (one note per release).

## Commands

- `pnpm install`, `pnpm dev` (http://localhost:5173), `pnpm build`, `pnpm lint`
- `pnpm db:migrate:local` / `pnpm db:migrate:remote`
- `pnpm deploy` builds and deploys the Worker to production
- Tests: `pnpm test:reliability` and `pnpm test:account-deletion`; other suites are `node scripts/<name>.test.mjs` (see `DEVELOPMENT.md` → Validation)

Before calling work done: TypeScript, `pnpm lint`, `pnpm build`, and the test script covering the code you changed must pass (see Workflow Constraints).

## Workflow Constraints

- Prefer running single/isolated tests rather than the entire test suite.
- Only test the specific file or block modified.

## Hard rules

1. **Never read, print, commit or move secrets.** `.dev.vars`, `.env*` and anything holding keys stay local and ignored. `SUPABASE_SECRET_KEY` is server-only and must never reach browser or iOS code. Only `.dev.vars.example` (placeholders) is committed.
2. **Production is live, and Codex is the only deployer.** Codex deploys from the owner's PC (`pnpm deploy`), then commits, pushes and writes the release note. Claude never deploys. Remote migrations (`pnpm db:migrate:remote`) and any change to production D1 or Supabase settings still need the owner's explicit go-ahead in that session. Export a backup before any remote migration (past backups go to `.local-backups/`, which is gitignored).
3. **Migrations are append-only.** Add a new numbered file in `drizzle/`; never edit one that has been applied.
4. **Authorization is server-side.** Every write goes through the existing club/tournament permission checks. Client state and stored cookies are never proof of identity.
5. **Don't commit local state:** `.codex/`, `.agents/`, `.sites-runtime/`, `.test-runtime/`, `.local-backups/`, `.wrangler/`, `dist/`, `node_modules/` are ignored for a reason.

## Workflow

- Work on a branch, not directly on `main`: `codex/<topic>` for Codex, `claude/<topic>` for Claude. Merge to `main` through a pull request unless the owner says otherwise.
- Commit subjects are short and imperative, e.g. "Add club sessions and opt-in reminders".
- Each user-visible release gets a `RELEASE_<TOPIC>_<YYYY-MM-DD>.md` note: what changed, deployed version ID, validation run, and what still needs real-device checks. Update `DEVELOPMENT.md` / `ROADMAP.md` when scope changes.
- Real iPhone behaviour (Home Screen install, safe areas, session persistence) can't be verified from a desktop browser; say so in the release note rather than claiming it.

## Deploying

- Merging to `main` on GitHub does **not** deploy. Production only changes when Codex runs `pnpm deploy`.
- Before every deploy, Codex runs `git pull` on `main` so work merged from Claude's branches is included, then runs the validation commands above. Never deploy from a stale local copy.
- Claude opens pull requests from `claude/<topic>` branches and notes in `HANDOFF.md` anything waiting to be merged or deployed.
- The release note names the deployed Worker version ID, as in the existing `RELEASE_*.md` files.

## Handing work between agents

Read `HANDOFF.md` first. Before you stop, add an entry at the top: what you changed, branch/commit, what was verified, what is unfinished, and anything the next agent must not touch.
