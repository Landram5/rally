# Note from Claude to Codex (2026-10-07)

Adam asked me to leave you this. Repo state beats this note; check `git log` and `git status` first.

## What changed

1. **Deploys now come from GitHub.** Cloudflare Workers Builds is connected to `Landram5/rally`.
   - A push or merge to `main` runs `pnpm run build`, then `npx wrangler deploy --config dist/server/wrangler.json`. That is the production deploy.
   - Other branches run `npx wrangler versions upload ...`, which makes a preview version and does not go live.
   - **Please stop running `pnpm deploy` from the PC.** It would double-deploy and could push a stale bundle over a newer merge. `pnpm db:migrate:remote` stays manual, and only with Adam's go-ahead and an export first.
   - The Cloudflare build token is currently the one named "landrum-remodeling-umbc-minecraft build token". Adam may want a Rally-specific one.

2. **Merged to `main` today (PR #1, commit 056583f):** the Player statistics panel on the profile Progress tab.
   - It is restyled in the Rally style, and the chart is always drawn, with a "No confirmed matches yet" message when empty.
   - `app/api/rally/route.ts` (performance view) now returns an empty snapshot for a real profile with no visible data, instead of 404 "Player unavailable."
   - Files: `app/api/rally/route.ts`, `app/player-performance.tsx`, `app/globals.css` (appended at the end). No migrations.
   - **Not run:** `pnpm test:reliability`, `pnpm lint`, `pnpm build`. My sandbox could not install packages. Please run them on your side and fix anything they flag. `scripts/player-performance.test.mjs` already asserts empty matches give empty points.
   - I confirmed the new CSS is live on rallytt.net. I did not check a real no-data profile on production.

3. **Pushed but not merged (waiting on Adam):**
   - `claude/agent-setup`: `AGENTS.md`, `CLAUDE.md` and `HANDOFF.md` (stack, commands, workflow constraints, coding rules, suggestions policy, hard rules, handoff format). Merging it triggers a production build. Its wording about `pnpm deploy` as a fallback is out of date, since Workers Builds is now verified.
   - `claude/match-header-logo`: the tab favicon, apple-touch-icon and PWA icons now match the header logo (lime tile, dark circle with a dot). `scripts/generate-app-icons.ps1` was updated to draw the same mark but has not been run. Note the PNGs were generated without running that script.

## Working agreements from Adam

- Branches: `claude/<topic>` for me, `codex/<topic>` for you. Use PRs unless Adam says otherwise.
- Minimum code that solves the problem; nothing speculative. Ask before suggestions (always with an "accept all" option) and report any that were implemented. Urgent bugs get flagged immediately.
- Prefer isolated tests for the file you changed. Run the full set (`pnpm test:reliability`, `pnpm lint`, `pnpm build`) once before merging to `main`.
- **Verify on localhost on Adam's machine rather than on Cloudflare preview builds.**
- Ask fewer questions. Only ask when something is genuinely unclear.
- Show UI work before it goes to production unless Adam has already approved it.
- Say "deployed" only after confirming the live site, not after a successful build.

## Open items

- "Rally rating history" showed "Player unavailable." in one of Adam's screenshots, while the same profile rendered "Unrated" on a preview. I did not change or explain it. It may depend on sign-in. Worth tracing through `getPublicPlayer` and the rating history path.
- Supabase leaked-password protection is off. Adam has to toggle it in the dashboard.
- Confirm the Supabase redirect allow-list and Site URL cover rallytt.net.
- Real iPhone and Home Screen checks are still outstanding. Everything so far was desktop emulation at 375px and 320px.
- Pull `main` before starting new work, and add a line to `HANDOFF.md` when you finish.

## Things I can't do

I can't deploy, can't reach the Cloudflare API from shells, and can't install npm packages in my sandbox. Anything that needs `pnpm` has to run on your side or on Adam's machine.
