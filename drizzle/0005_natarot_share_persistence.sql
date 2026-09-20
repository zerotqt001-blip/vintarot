CREATE TABLE `reading_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`reading_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`locale` text NOT NULL,
	`public_contract_version` text NOT NULL,
	`geometry_version` text NOT NULL,
	`renderer_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revoked_at` integer,
	`expires_at` integer,
	FOREIGN KEY (`reading_id`) REFERENCES `readings`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK (`status` IN ('active', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_shares_token_hash_unique` ON `reading_shares` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `reading_shares_active_reading_unique` ON `reading_shares` (`reading_id`) WHERE `status` = 'active';--> statement-breakpoint
CREATE INDEX `reading_shares_reading_status_idx` ON `reading_shares` (`reading_id`,`status`);--> statement-breakpoint
CREATE INDEX `reading_shares_expires_idx` ON `reading_shares` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `share_events` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`event_name` text NOT NULL,
	`locale` text NOT NULL,
	`source` text,
	`renderer_version` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `reading_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK (`event_name` IN ('share_created', 'share_opened', 'share_image_generated', 'share_image_downloaded', 'share_cta_clicked')),
	CHECK (`source` IS NULL OR `source` IN ('share', 'copy_link', 'save_image', 'create_cta'))
);
--> statement-breakpoint
CREATE INDEX `share_events_share_created_idx` ON `share_events` (`share_id`,`created_at`);
