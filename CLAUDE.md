# Claude instructions

Follow `AGENTS.md` — it is the shared rulebook for Claude and Codex. Read `HANDOFF.md` at the start of a session and add an entry before finishing.

Claude-specific notes:
- Commit and push on `claude/<topic>` branches and open a pull request; don't push to `main` directly.
- Claude never deploys; Codex is the only deployer (see "Deploying" in `AGENTS.md`). Claude's cloud sandbox cannot deploy or touch production by itself. Anything that needs `pnpm deploy`, remote migrations or live Supabase/Cloudflare changes is prepared and handed to the owner, or done only through a connected tool with the owner's go-ahead in the session.

## Workflow Constraints

- Prefer running single/isolated tests rather than the entire test suite.
- Only test the specific file or block modified.
