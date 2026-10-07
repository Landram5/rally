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
