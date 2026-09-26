CREATE TABLE `business_reporting_sync_state` (
  `id` text PRIMARY KEY NOT NULL CHECK (`id` = 'primary'),
  `spreadsheet_id` text,
  `last_attempt_at` integer,
  `last_success_at` integer,
  `last_reconciliation_date` text,
  `retry_attempt` integer NOT NULL DEFAULT 0,
  `next_retry_at` integer,
  `last_error_code` text,
  `lease_owner` text,
  `lease_expires_at` integer,
  `last_backup_id` text,
  `last_backup_attempt_at` integer,
  `last_backup_success_at` integer,
  `last_backup_status` text,
  `last_backup_error_code` text,
  `last_backup_drive_file_id` text,
  `last_alert_sent_at` integer,
  `updated_at` integer NOT NULL DEFAULT 0,
  CHECK (`retry_attempt` >= 0),
  CHECK (`last_backup_status` IS NULL OR `last_backup_status` IN ('pending', 'uploaded', 'verified', 'failed'))
);
INSERT INTO `business_reporting_sync_state` (`id`, `updated_at`) VALUES ('primary', 0);
--> statement-breakpoint
CREATE TABLE `business_reporting_row_state` (
  `sheet_name` text NOT NULL,
  `row_key` text NOT NULL,
  `row_number` integer NOT NULL,
  `row_hash` text NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`sheet_name`, `row_key`),
  UNIQUE (`sheet_name`, `row_number`),
  CHECK (`sheet_name` IN ('Dashboard', 'Customers', 'Revenue', 'Affiliate', 'Referrals', 'Activity', 'Credits', 'System')),
  CHECK (`row_number` >= 2),
  CHECK (length(`row_hash`) = 64)
);
--> statement-breakpoint
CREATE TABLE `business_reporting_activity_daily` (
  `business_date` text PRIMARY KEY NOT NULL,
  `active_users` integer NOT NULL,
  `captured_at` integer NOT NULL,
  CHECK (`active_users` >= 0),
  CHECK (length(`business_date`) = 10)
);
--> statement-breakpoint
CREATE TABLE `business_reporting_export_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `job_type` text NOT NULL,
  `outcome` text NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer,
  `rows_written` integer NOT NULL DEFAULT 0,
  `error_code` text,
  CHECK (`job_type` IN ('sheets_sync', 'drive_backup')),
  CHECK (`outcome` IN ('started', 'success', 'blocked', 'failure')),
  CHECK (`rows_written` >= 0)
);
CREATE INDEX `business_reporting_export_audit_started_idx` ON `business_reporting_export_audit` (`job_type`, `started_at`);
--> statement-breakpoint
CREATE TABLE `business_reporting_backup_runs` (
  `backup_id` text PRIMARY KEY NOT NULL,
  `status` text NOT NULL,
  `source_sha256` text,
  `encrypted_sha256` text,
  `drive_file_id` text,
  `manifest_file_id` text,
  `source_bytes` integer,
  `encrypted_bytes` integer,
  `verified_at` integer,
  `error_code` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CHECK (`status` IN ('pending', 'uploaded', 'verified', 'failed')),
  CHECK (`source_bytes` IS NULL OR `source_bytes` >= 0),
  CHECK (`encrypted_bytes` IS NULL OR `encrypted_bytes` >= 0),
  CHECK (`source_sha256` IS NULL OR length(`source_sha256`) = 64),
  CHECK (`encrypted_sha256` IS NULL OR length(`encrypted_sha256`) = 64)
);
CREATE INDEX `business_reporting_backup_status_idx` ON `business_reporting_backup_runs` (`status`, `updated_at`);
