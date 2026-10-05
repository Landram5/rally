# Rally development status

## Implemented

- Supabase Auth with Google OAuth, email/password sign-up, email/password sign-in, password reset, password update, and server-managed cookie sessions.
- Durable D1 records for profiles, clubs, memberships, matches, audit events, tournaments, and tournament entries.
- Server-side authorization for all writes, including membership approval, result confirmation, tournament administration, and audit history.
- Public player and tournament pages limited to confirmed results and public event data.
- Tournament draws, seeding, byes, round robin standings, withdrawals, walkovers, result resets, and winner display.
- Original sample experience at `/demo`, separate from real accounts and records.
- Installable iPhone web app with a Home Screen icon, standalone display, safe-area layout, install instructions, and a privacy-safe offline fallback.

## Configuration still required

- Create the production Supabase project and enable its Google provider.
- Configure allowed redirect URLs and production email delivery in Supabase.
- Create the production Cloudflare D1 database and replace the placeholder ID in `wrangler.jsonc`.
- Add the two Supabase Worker bindings, apply remote D1 migrations, and deploy.
- If preserving records from the former hosted preview, export that D1 database and import it into the new D1 database before launch. Existing profile ownership must be mapped deliberately to the corresponding Supabase user IDs.

## Next product work

- Public player and tournament discovery with search and filters.
- Club administrator delegation and guest account claims.
- Skill ratings, table/time scheduling, divisions, and organizer audit-history UI.
- Offline-friendly score entry and background synchronization.

## Validation

- `node scripts/rally-service.test.mjs`
- `node scripts/tournament-engine.test.mjs`
- `node --experimental-strip-types scripts/rally.test.mjs`
- `pnpm lint`
- `pnpm build`

Real Google OAuth and email delivery require configured Supabase credentials and are verified after the production project exists.
