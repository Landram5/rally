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
