ALTER TABLE `clubs` ADD `approval_status` text DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE `clubs` ADD `reviewed_by` text;
--> statement-breakpoint
ALTER TABLE `clubs` ADD `reviewed_at` text;
--> statement-breakpoint
CREATE INDEX `idx_clubs_approval` ON `clubs` (`approval_status`);
