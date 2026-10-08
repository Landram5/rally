Production rollout: PRs #2–#5 merged on 2026-10-07. Feature Worker version a9b74058-f1da-4ab2-9a76-91418a92f158; after secure push-key configuration, ec4cb981-e281-4a68-87a0-62a12b7b3900. Migrations 0020–0022 applied after backup. See newest HANDOFF.md entry for outstanding provider and device checks. Earlier pre-release status below is historical.

# Club sessions — prepared, not deployed

Branch: `codex/sessions`, stacked on `codex/notifications`. Production version: none.

Organizers can repeat a session weekly in their device's time zone, skip one date, or stop the series and cancel its future dates. Dates are generated eight weeks ahead and extended by the existing cron. Each date has its own RSVP and editable details; editing one date does not edit the series template. The same local start time is retained across daylight-saving changes. A nonexistent spring time shifts forward by the clock gap; an autumn overlap uses the earlier occurrence. Elapsed session duration is retained.

Members can RSVP Going, Maybe or Not going and bring one guest. Going reserves one or two places. Maybe does not reserve capacity. Full sessions put the whole party on a FIFO waitlist, show the member's position and promote eligible parties atomically when places open. A smaller party cannot jump a larger party at the head. A party is never split. Increased/removed capacity also promotes waiting parties.

Removing a member or deleting an account clears its old reservation and promotes the next eligible party. Re-approving that member does not restore an old reservation and overfill the session. Sessions still require active club membership; owners, administrators and board members manage them. Inbox/session reminder rules remain unchanged; only confirmed Going RSVPs receive session reminders.

Migration `0021_recurring_sessions_and_waitlist.sql` adds series fields and rebuilds the RSVP table while retaining existing rows. SQLite views and triggers enforce promotion inside the mutation transaction. Applied to local D1 only. Production needs an export and Adam's explicit go-ahead before dependent code merges. No local deploy.

Validation: isolated session tests cover retry-safe generation, skip persistence, DST spring/fall/gap/overlap, stop permissions and stale revisions, guest capacity, FIFO parties, Maybe, concurrent RSVP capacity, automatic promotion, membership reactivation and deletion. Local D1 accepted the migration. Local UI fixture verified the actual form and cards at mobile width: page 375px equals scroll width, both datetime inputs fit their containers. The fixture was removed before the final build; it did not bypass API authentication. Physical iPhone/Android and an authenticated live-club browser flow remain pending. Full branch reliability/lint/build results are recorded in HANDOFF.
