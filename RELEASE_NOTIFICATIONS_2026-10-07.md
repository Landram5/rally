# Notification delivery — prepared, not deployed

Branch: `codex/notifications`, stacked on `codex/safety`. Production version: none.

Email and web push deliver three existing inbox events: a result needing confirmation, a ready tournament fixture, and an upcoming session the player is attending. Event preferences still control eligibility. Read, resolved, cancelled, revoked and deleted-account items are checked again before delivery. Delivery does not mark an inbox item read.

Both channels default to off. Push requires a device opt-in in Account settings, in addition to the account preference. iPhone users must open the Home Screen app. Each account supports five devices. Sign-out removes only the current device; account deletion removes all devices and delivery records. Push endpoint validation permits the standard Chrome, Firefox, Apple and Edge services. Browser permission rejection is recoverable in device settings.

Migration `0020_notification_delivery.sql` adds opt-ins, device subscriptions, scan leases and durable delivery receipts. Apply locally first. Before production: obtain Adam's approval, export D1, apply the migration, then merge dependent code. Do not deploy from this checkout.

Configure Resend with a verified sending domain, `RESEND_API_KEY` and `NOTIFICATION_FROM`. Configure Web Push with a P-256 VAPID key pair (`VAPID_PUBLIC_KEY`, server-only `VAPID_PRIVATE_KEY`) and a real contact `VAPID_SUBJECT`. Store secrets through the provider's secure interface, never in chat or tracked files. Email recipients come from verified Supabase Auth records. Sender setup and real delivery are pending.

Resend requests use stable idempotency keys and frozen message content. Retries stop after five attempts or 23 hours, within the provider's 24-hour idempotency window. Permanent failures stop; push 404/410 removes expired subscriptions. Device notification tags collapse repeats, but Web Push does not promise exactly-once delivery. Failed messages leave the inbox intact.

Initial throughput: five subscribed accounts per scan, three pending deliveries per account. Scans run after successful Rally/session writes and every five minutes, ordered by last scan. This bounds Worker database/network usage; it does **not** guarantee instant call-ups under a larger backlog. Event-targeted queueing is required before relying on this for busy multi-table events. Monitoring: provider dashboards, sanitized Worker error logs, and the server-only delivery table. External delivery defaults off, so missing configuration does not affect inbox use.

Validation: reliability, lint and build passed on the initial implementation; final branch checks are recorded in HANDOFF. SQLite migration and delivery tests cover opt-ins, old clients, event filtering, deduplication, stable retries, cancellation, overlapping scans, expired subscriptions, encrypted payload construction, endpoint validation and deletion cleanup. No real emails or pushes were sent by tests. Physical iPhone/Android permission and delivery checks remain pending.

References: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Web Crypto Web Push](https://github.com/block65/webcrypto-web-push/tree/master/packages/web-push).
