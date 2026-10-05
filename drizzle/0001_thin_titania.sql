CREATE TABLE `tournament_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`before_state` text,
	`after_state` text,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tournament_operations_event` ON `tournament_operations` (`tournament_id`);--> statement-breakpoint
ALTER TABLE `matches` ADD `tournament_id` text;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `status` text DEFAULT 'registration' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `best_of` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `state_json` text;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `last_operation` text;