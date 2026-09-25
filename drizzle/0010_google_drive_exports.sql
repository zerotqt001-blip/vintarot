CREATE TABLE `google_drive_oauth_states` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `code_verifier` text NOT NULL,
  `return_path` text NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `consumed_at` integer,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `google_drive_oauth_states_expiry_idx` ON `google_drive_oauth_states` (`expires_at`, `consumed_at`);
--> statement-breakpoint
CREATE TABLE `google_drive_connections` (
  `member_id` text PRIMARY KEY NOT NULL,
  `google_subject` text NOT NULL,
  `google_email` text NOT NULL,
  `refresh_token_ciphertext` text NOT NULL,
  `granted_scope` text NOT NULL,
  `connected_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reading_drive_exports` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `reading_id` text NOT NULL,
  `mime_type` text NOT NULL,
  `drive_file_id` text NOT NULL,
  `drive_url` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE CASCADE,
  CHECK (`mime_type` IN ('image/png', 'image/jpeg'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_drive_exports_owner_reading_format_unique` ON `reading_drive_exports` (`member_id`, `reading_id`, `mime_type`);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_drive_exports_file_unique` ON `reading_drive_exports` (`drive_file_id`);
--> statement-breakpoint
CREATE INDEX `reading_drive_exports_owner_updated_idx` ON `reading_drive_exports` (`member_id`, `updated_at`);
