# Rally

Active release: website and Add to Home Screen. Use this top-level folder as the working source; see [consolidation and release checklist](CONSOLIDATION.md) for the pending Mac merge and launch gates.

Rally is a full-stack table tennis club and tournament platform built with Next.js/Vinext for Cloudflare Workers. It stores application data in Cloudflare D1 and uses Supabase Auth for Google OAuth and email/password accounts.

## Local setup

Requirements: Node.js 22.13 or newer and pnpm.

1. Install dependencies with `pnpm install`.
2. Copy `.dev.vars.example` to `.dev.vars` and add the Supabase project URL and publishable key.
3. Apply the local D1 migrations with `pnpm db:migrate:local`.
4. Start Rally with `pnpm dev` and open `http://localhost:5173`.

For Google sign-in, enable the Google provider in Supabase and add `http://localhost:5173/auth/callback` to the Supabase redirect allow list. Email/password sign-up works through the same Supabase project. Keep email confirmation enabled for production.

## Production setup

1. Create a Cloudflare D1 database named `rally-table-tennis`.
2. Replace the placeholder `database_id` in `wrangler.jsonc` with the created database ID.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as Worker secrets or environment variables.
4. Add the production `/auth/callback` URL to Supabase's redirect allow list and configure the production Site URL.
5. Apply migrations with `pnpm db:migrate:remote`.
6. Build and deploy with `pnpm deploy`.

Google’s OAuth client secret stays in Supabase. Rally never stores account passwords or OAuth tokens in D1.

## Install on iPhone

Open the deployed Rally URL in Safari, tap **Share**, choose **Add to Home Screen**, and tap **Add**. Rally launches in a standalone window with its own Home Screen icon and uses the same live account and data as the website. The in-app instructions are available at `/install`.

The service worker caches only the offline screen and public icon assets. It does not cache authenticated pages or API responses.

## Main commands

- `pnpm dev` starts the Vinext development server.
- `pnpm build` creates the Cloudflare Worker bundle.
- `pnpm start` previews the built Worker locally.
- `pnpm deploy` builds and deploys the Worker.
- `pnpm db:migrate:local` applies D1 migrations locally.
- `pnpm db:migrate:remote` applies D1 migrations to the configured remote database.
- `pnpm lint` runs ESLint.
- `node scripts/rally-service.test.mjs` runs service and permission tests.
- `node scripts/tournament-engine.test.mjs` runs tournament engine tests after the service test compiles the shared modules.

## Authentication model

Supabase owns account verification, password hashing, OAuth identities, and session refresh. Rally validates the current Supabase user on the server and stores only the stable Supabase user ID in `profiles.auth_id`. All mutations still pass through Rally's existing club and tournament authorization rules.

Public player and tournament URLs return confirmed results only. The clubhouse API and every write action require a valid account session.

## Account deletion

Account settings supports club ownership transfer and account deletion with two history options. See [ACCOUNT-DELETION.md](ACCOUNT-DELETION.md) for configuration and verification details.
