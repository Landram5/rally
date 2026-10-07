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
- Before anything is merged to `main` (which deploys to production), run the full set once: `pnpm test:reliability`, `pnpm lint` and `pnpm build`.

## Coding Rules

- Write the minimum amount of code that solves the problem. Nothing speculative.
- Do not add features, error handling for impossible scenarios, or config abstractions beyond what was specifically asked.
- Exceptions: always validate and handle failures where outside data comes in (user input, sign-in and permissions, the database, the network, browser storage). Tests for changed behavior and new migrations are required work, not extras.

## Suggestions

If you think something should be added or changed, because it would improve the user experience, look better, make the product more useful, or prevent a future issue, do not build it unprompted.

- Pause and ask the owner before working on it. Every ask includes an **Accept all** option (a plain reply of "accept all" is enough).
- "Accept all" covers only the batch of suggestions in that message, not future ones.
- Once accepted, implement it and tell the owner it was implemented. Don't ask again for that batch.
- If the owner isn't available, don't wait. Write the suggestion in `HANDOFF.md` and carry on with the original task.
- Bugs, security problems and data-loss risks are different: flag them to the owner right away, marked **urgent**, instead of queuing them with ordinary suggestions.

## Hard rules

1. **Never read, print, commit or move secrets.** `.dev.vars`, `.env*` and anything holding keys stay local and ignored. `SUPABASE_SECRET_KEY` is server-only and must never reach browser or iOS code. Only `.dev.vars.example` (placeholders) is committed.
2. **Production is live.** Cloudflare Workers Builds is connected to `Landram5/rally` (branch `main`): every push or merge to `main` builds and deploys to rallytt.net. Remote migrations (`pnpm db:migrate:remote`) and any change to production D1 or Supabase settings still need the owner's explicit go-ahead in that session. Claude never runs a deploy itself; it only opens pull requests.
3. **Migrations are append-only.** Add a new numbered file in `drizzle/`; never edit one that has been applied.
4. **Authorization is server-side.** Every write goes through the existing club/tournament permission checks. Client state and stored cookies are never proof of identity.
5. **Don't commit local state:** `.codex/`, `.agents/`, `.sites-runtime/`, `.test-runtime/`, `.local-backups/`, `.wrangler/`, `dist/`, `node_modules/` are ignored for a reason.

## Workflow

- Work on a branch, not directly on `main`: `codex/<topic>` for Codex, `claude/<topic>` for Claude. Merge to `main` through a pull request unless the owner says otherwise.
- Commit subjects are short and imperative, e.g. "Add club sessions and opt-in reminders".
- Each user-visible release gets a `RELEASE_<TOPIC>_<YYYY-MM-DD>.md` note: what changed, deployed version ID, validation run, and what still needs real-device checks. Update `DEVELOPMENT.md` / `ROADMAP.md` when scope changes.
- Real iPhone behaviour (Home Screen install, safe areas, session persistence) can't be verified from a desktop browser; say so in the release note rather than claiming it.

## Deploying

- **How it works:** pushing or merging to `main` triggers a Cloudflare build (`pnpm run build`, then `npx wrangler deploy --config dist/server/wrangler.json`). Other branches only upload preview versions; they don't go live. Build history is in the Cloudflare dashboard (Worker `rally-table-tennis` → Deployments).
- **Status:** connected 2026-10-07; the first build has **not** been verified yet. Until a build succeeds and the release note records its version, Codex may still run `pnpm deploy` from the owner's PC as the fallback. After that, Codex should only push, not also run `pnpm deploy`, so the same code isn't deployed twice.
- **Migrations come first:** a new file in `drizzle/` must be applied to production D1 (with an export beforehand and the owner's go-ahead) *before* the code that needs it is merged to `main`.
- **Pull before you work:** run `git pull` on `main` before starting, so work merged from Claude's branches is included.
- Release notes name the deployed Worker version ID, as in the existing `RELEASE_*.md` files.

## Handing work between agents

Read `HANDOFF.md` first. Before you stop, add an entry at the top: what you changed, branch/commit, what was verified, what is unfinished, and anything the next agent must not touch.
