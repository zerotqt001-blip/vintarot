CREATE TABLE `members` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `display_name` text,
  `password_hash` text,
  `google_subject` text,
  `email_verified_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `last_login_at` integer,
  `disabled` integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX `idx_members_username` ON `members` (`username`);
CREATE UNIQUE INDEX `idx_members_email` ON `members` (`email`);
CREATE UNIQUE INDEX `idx_members_google_subject` ON `members` (`google_subject`);
CREATE INDEX `idx_members_phone` ON `members` (`phone`);
CREATE TABLE `auth_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL REFERENCES `members`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL,
  `revoked_at` integer
);
CREATE INDEX `idx_auth_sessions_member` ON `auth_sessions` (`member_id`);
CREATE INDEX `idx_auth_sessions_expiry` ON `auth_sessions` (`expires_at`);
CREATE TABLE `auth_tokens` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `member_id` text REFERENCES `members`(`id`) ON DELETE CASCADE,
  `payload` text,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `consumed_at` integer
);
CREATE INDEX `idx_auth_tokens_kind_expiry` ON `auth_tokens` (`kind`, `expires_at`);
CREATE INDEX `idx_auth_tokens_member` ON `auth_tokens` (`member_id`);
CREATE TABLE `oauth_states` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `code_verifier` text NOT NULL,
  `return_path` text NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `consumed_at` integer
);
CREATE INDEX `idx_oauth_states_expiry` ON `oauth_states` (`expires_at`);
