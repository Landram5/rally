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

## 2026-10-07 — Claude — agent setup
- Branch/commit: `claude/agent-setup`
- Changed: added `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`. No application code changed.
- Verified: docs only; commands and test names checked against `package.json` and `scripts/`.
- Not done / open questions: Supabase and Cloudflare connectors not yet linked to Claude, so deploy/branch conventions for Cloudflare's GitHub integration are unconfirmed. Latest known production state is in `RELEASE_ONBOARDING_2026-10-07.md`.
- Don't touch: `.dev.vars`, production D1, Supabase settings.
