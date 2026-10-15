# Monitoring Rally

## The health check
`https://rallytt.net/api/health` answers `200` when the database responds and the five-minute maintenance job has run in the last 20 minutes, and `503` otherwise. It shows no private data.

```json
{"ok":true,"database":true,"checkedAt":"2026-10-15T12:00:00.000Z","scheduled":{"ranAt":"2026-10-15T11:56:00.000Z","ageSeconds":240,"stale":false,"failedJobs":[]}}
```

- `scheduled: null` right after a deploy is normal until the first run (within five minutes).
- `failedJobs` lists maintenance jobs that failed on their last run (for example `notifications` or `Discord gateway`). The site keeps working, but that work is not happening.

## Set up the outside watcher (5 minutes, free)
A check can only run if something calls it. Use any uptime service (UptimeRobot, Better Stack and Pingdom all have free plans):

1. Create an HTTP(S) monitor for `https://rallytt.net/api/health`, checking every 5 minutes.
2. Alert when the status is not `200` (or the body no longer contains `"ok":true`).
3. Send alerts to your email or phone.

That covers "the site is down" and "the background jobs stopped".

## What Rally emails you
When a maintenance job fails, every address in `RALLY_ADMIN_EMAILS` gets one email naming the failed jobs. At most one every six hours, so a long outage is one email. New clubs also email you to be verified.

## When something looks wrong
1. Open `/api/health`. `database: false` means the database is unreachable. `stale: true` means the cron trigger stopped.
2. Cloudflare dashboard > Workers & Pages > rally-table-tennis > Logs shows errors (observability is on).
3. A deploy that never finishes: Workers > Builds shows the build log. The CI check on the pull request runs the same production build, so a hanging or failing build shows up there before merging.
