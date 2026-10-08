Production rollout: PR #2 merged on 2026-10-07 with subsequent releases #3–#5. Worker version ec4cb981-e281-4a68-87a0-62a12b7b3900 has both Turnstile bindings, native rate limits and push configuration. Owner CSV controls verified live. Supabase CAPTCHA activation still awaits owner confirmation. See newest HANDOFF.md entry; earlier pre-release status below is historical.

# Safety release — prepared October 7, 2026

Write endpoints use Cloudflare native rate limits. Club owners and administrators can download roster, results and current Rally ratings from Club → Management → Manage club. Server checks exclude board members, ordinary members, pending/revoked memberships and administrators of other clubs. CSV cells neutralize formulas and preserve quoted/multiline names. Downloads are private and contain no email or Auth identifiers.

## Configuration required before merge

1. Create a managed Turnstile widget for `rallytt.net` (and approved preview hostnames if needed). Set `TURNSTILE_SITE_KEY` as a Worker variable and `TURNSTILE_SECRET_KEY` as a Worker secret through a secure settings interface. Never put secret values in Git or chat.
2. With Adam's explicit approval, coordinate activation: deploy the reviewed new Auth forms through Workers Builds, then immediately enable Supabase Auth CAPTCHA using Turnstile and this widget's secret. Never enable provider CAPTCHA while the old forms are live; they do not send tokens. Signup, password sign-in and reset send one token to Supabase for validation. Feedback uses server Siteverify with hostname/action checks. Do not consume Auth tokens with Siteverify before Supabase; tokens are single-use.
3. Check valid signup/signin/reset and rejected invalid/replayed tokens against the configured provider, then review the UI before merge. Existing sessions and Google OAuth do not need the widget.
4. Merge via GitHub/Workers Builds. No D1 migration; no local deploy command. Never ship dummy test keys to production.

Limits: 500 write requests/IP/minute, 10 auth writes/IP/minute, 60 writes/account/minute. These Cloudflare limits are approximate and location-scoped; they are abuse controls, not globally precise quotas. Rate-limit outages return 503; denied requests return 429 with Retry-After. A shared club network has the higher ordinary-IP ceiling plus separate account budgets.

## Validation

`pnpm test:reliability`, `pnpm lint`, `pnpm build` and `pnpm exec tsc --noEmit` passed. Added real SQLite authorization/rating export tests and mock-provider tests of the actual Auth routes. Local built-Worker checks verified CAPTCHA rendering at desktop/mobile widths, native 429 responses and anonymous export rejection. No real signup or email was sent. Live CAPTCHA provider configuration and actual Home Screen devices still need verification.

Security patches: Next 16.3.8, Vinext 1.0.0 / RSC plugin 0.5.34, patched browserslist/source-map-js overrides and Miniflare sharp 0.35.5. `pnpm audit --prod --audit-level high` passes; one low and one moderate finding remain. The checked Next advisory applies to attacker-controlled Node ImageResponse SVG; Rally does not import next/og. Patch retained to remove the vulnerable dependency.

Official references: [Cloudflare rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

Review verification: temporarily granting board export access made the safety suite fail; restoring owner/admin-only access made it pass.

Deployment retains dashboard-managed runtime Variables (`keep_vars: true`), including the public Turnstile Site Key. Secret values stay managed by Cloudflare. Build-environment variables alone do not configure runtime bindings.
