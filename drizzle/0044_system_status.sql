-- Heartbeat of the scheduled maintenance job, so /api/health can tell whether it is still running and an alert is not repeated every five minutes.
CREATE TABLE system_status (
 name TEXT PRIMARY KEY NOT NULL,
 ran_at TEXT NOT NULL,
 failed TEXT NOT NULL DEFAULT '',
 last_alert_at TEXT
);
