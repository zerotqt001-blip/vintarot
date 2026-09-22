ALTER TABLE `members` ADD COLUMN `role` text NOT NULL DEFAULT 'USER' CHECK (`role` IN ('USER', 'SUPPORT', 'FINANCE', 'CONTENT_ADMIN', 'ADMIN', 'SUPER_ADMIN'));
ALTER TABLE `members` ADD COLUMN `disabled_at` integer;
ALTER TABLE `members` ADD COLUMN `disabled_reason` text;
ALTER TABLE `members` ADD COLUMN `disabled_by` text;
CREATE INDEX `members_role_status_idx` ON `members` (`role`, `disabled`);

ALTER TABLE `auth_sessions` ADD COLUMN `session_id` text;
UPDATE `auth_sessions` SET `session_id` = lower(hex(randomblob(16))) WHERE `session_id` IS NULL;
CREATE UNIQUE INDEX `auth_sessions_session_id_unique` ON `auth_sessions` (`session_id`);
CREATE INDEX `auth_sessions_member_active_idx` ON `auth_sessions` (`member_id`, `revoked_at`, `expires_at`);

CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_kind` text NOT NULL,
  `actor_id` text NOT NULL,
  `action` text NOT NULL,
  `target_type` text,
  `target_id` text,
  `reason` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `outcome` text NOT NULL DEFAULT 'SUCCESS',
  `metadata_json` text NOT NULL DEFAULT '{}',
  `created_at` integer NOT NULL,
  CHECK (`actor_kind` IN ('member', 'system')),
  CHECK (`outcome` IN ('SUCCESS', 'DENIED', 'FAILURE')),
  CHECK (length(trim(`actor_id`)) > 0),
  CHECK (length(trim(`action`)) > 0),
  CHECK (length(trim(`reason`)) > 0),
  CHECK (length(`metadata_json`) <= 32768)
);
CREATE UNIQUE INDEX `audit_events_idempotency_unique` ON `audit_events` (`idempotency_key`);
CREATE INDEX `audit_events_actor_created_idx` ON `audit_events` (`actor_id`, `created_at`, `id`);
CREATE INDEX `audit_events_target_created_idx` ON `audit_events` (`target_type`, `target_id`, `created_at`, `id`);

CREATE TABLE `affiliate_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ACTIVE',
  `fraud_note_ciphertext` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`status` IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);
CREATE UNIQUE INDEX `affiliate_profiles_member_unique` ON `affiliate_profiles` (`member_id`);
CREATE INDEX `affiliate_profiles_status_idx` ON `affiliate_profiles` (`status`, `created_at`);

CREATE TABLE `referral_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `affiliate_profile_id` text NOT NULL,
  `code_hash` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ACTIVE',
  `source` text,
  `created_at` integer NOT NULL,
  `expires_at` integer,
  FOREIGN KEY (`affiliate_profile_id`) REFERENCES `affiliate_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`status` IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
  CHECK (`expires_at` IS NULL OR `expires_at` > `created_at`)
);
CREATE UNIQUE INDEX `referral_codes_hash_unique` ON `referral_codes` (`code_hash`);
CREATE INDEX `referral_codes_profile_status_idx` ON `referral_codes` (`affiliate_profile_id`, `status`, `expires_at`);

CREATE TABLE `referral_attributions` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_key` text NOT NULL,
  `member_id` text,
  `affiliate_profile_id` text NOT NULL,
  `referral_code_id` text NOT NULL,
  `source` text,
  `attributed_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`affiliate_profile_id`) REFERENCES `affiliate_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`referral_code_id`) REFERENCES `referral_codes`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (length(trim(`owner_key`)) > 0),
  CHECK (`expires_at` > `attributed_at`)
);
CREATE UNIQUE INDEX `referral_attributions_owner_unique` ON `referral_attributions` (`owner_key`);
CREATE INDEX `referral_attributions_profile_idx` ON `referral_attributions` (`affiliate_profile_id`, `attributed_at`);
CREATE INDEX `referral_attributions_member_idx` ON `referral_attributions` (`member_id`, `attributed_at`);

CREATE TABLE `affiliate_policy_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `version` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'DRAFT',
  `attribution_window_days` integer NOT NULL,
  `hold_days` integer NOT NULL,
  `currency` text NOT NULL,
  `starts_at` integer NOT NULL,
  `ends_at` integer,
  `created_at` integer NOT NULL,
  CHECK (`version` > 0),
  CHECK (`status` IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CHECK (`attribution_window_days` > 0 AND `attribution_window_days` <= 3650),
  CHECK (`hold_days` >= 0 AND `hold_days` <= 3650),
  CHECK (`ends_at` IS NULL OR `ends_at` > `starts_at`),
  CHECK (length(`currency`) BETWEEN 3 AND 3)
);
CREATE UNIQUE INDEX `affiliate_policy_versions_version_unique` ON `affiliate_policy_versions` (`version`);
CREATE INDEX `affiliate_policy_versions_active_idx` ON `affiliate_policy_versions` (`status`, `starts_at`, `ends_at`);

CREATE TABLE `affiliate_policy_tiers` (
  `id` text PRIMARY KEY NOT NULL,
  `policy_version_id` text NOT NULL,
  `tier_code` text NOT NULL,
  `min_qualified_conversions` integer NOT NULL,
  `rate_bps` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`policy_version_id`) REFERENCES `affiliate_policy_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`min_qualified_conversions` >= 0),
  CHECK (`rate_bps` >= 0 AND `rate_bps` <= 10000)
);
CREATE UNIQUE INDEX `affiliate_policy_tiers_code_unique` ON `affiliate_policy_tiers` (`policy_version_id`, `tier_code`);
CREATE UNIQUE INDEX `affiliate_policy_tiers_threshold_unique` ON `affiliate_policy_tiers` (`policy_version_id`, `min_qualified_conversions`);
CREATE INDEX `affiliate_policy_tiers_threshold_idx` ON `affiliate_policy_tiers` (`policy_version_id`, `min_qualified_conversions`);

CREATE TABLE `affiliate_conversions` (
  `id` text PRIMARY KEY NOT NULL,
  `event_key` text NOT NULL,
  `order_id` text NOT NULL,
  `fulfillment_id` text NOT NULL,
  `member_id` text NOT NULL,
  `attribution_id` text NOT NULL,
  `affiliate_profile_id` text NOT NULL,
  `policy_version_id` text NOT NULL,
  `tier_id` text NOT NULL,
  `amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `commission_minor` integer NOT NULL,
  `payment_reference` text NOT NULL,
  `package_snapshot` text NOT NULL,
  `status` text NOT NULL DEFAULT 'HELD',
  `fulfilled_at` integer NOT NULL,
  `eligible_at` integer,
  `reversed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`fulfillment_id`) REFERENCES `order_fulfillments`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`attribution_id`) REFERENCES `referral_attributions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`affiliate_profile_id`) REFERENCES `affiliate_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`policy_version_id`) REFERENCES `affiliate_policy_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`tier_id`) REFERENCES `affiliate_policy_tiers`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`amount_minor` >= 0),
  CHECK (`commission_minor` >= 0),
  CHECK (`status` IN ('HELD', 'ELIGIBLE', 'REVERSED', 'ADJUSTED')),
  CHECK (`eligible_at` IS NULL OR `eligible_at` >= `fulfilled_at`),
  CHECK (`reversed_at` IS NULL OR `reversed_at` >= `fulfilled_at`)
);
CREATE UNIQUE INDEX `affiliate_conversions_event_unique` ON `affiliate_conversions` (`event_key`);
CREATE UNIQUE INDEX `affiliate_conversions_fulfillment_unique` ON `affiliate_conversions` (`fulfillment_id`);
CREATE INDEX `affiliate_conversions_member_created_idx` ON `affiliate_conversions` (`member_id`, `created_at`, `id`);
CREATE INDEX `affiliate_conversions_profile_status_idx` ON `affiliate_conversions` (`affiliate_profile_id`, `status`, `created_at`);

CREATE TABLE `affiliate_commission_ledger` (
  `id` text PRIMARY KEY NOT NULL,
  `conversion_id` text NOT NULL,
  `entry_type` text NOT NULL,
  `direction` text NOT NULL,
  `amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `reversal_of_id` text,
  `actor_kind` text NOT NULL DEFAULT 'system',
  `actor_id` text NOT NULL DEFAULT 'system',
  `reason` text NOT NULL,
  `policy_snapshot` text NOT NULL,
  `tier_snapshot` text NOT NULL,
  `package_snapshot` text NOT NULL,
  `fraud_note_ciphertext` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`conversion_id`) REFERENCES `affiliate_conversions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reversal_of_id`) REFERENCES `affiliate_commission_ledger`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`entry_type` IN ('COMMISSION', 'ELIGIBILITY', 'REVERSAL', 'ADJUSTMENT')),
  CHECK (`direction` IN ('CREDIT', 'DEBIT')),
  CHECK (`amount_minor` >= 0),
  CHECK (`actor_kind` IN ('member', 'system', 'admin')),
  CHECK (length(trim(`reason`)) > 0)
);
CREATE UNIQUE INDEX `affiliate_commission_ledger_key_unique` ON `affiliate_commission_ledger` (`idempotency_key`);
CREATE INDEX `affiliate_commission_ledger_conversion_idx` ON `affiliate_commission_ledger` (`conversion_id`, `created_at`, `id`);
CREATE INDEX `affiliate_commission_ledger_actor_idx` ON `affiliate_commission_ledger` (`actor_id`, `created_at`, `id`);

INSERT INTO `affiliate_policy_versions` (`id`, `version`, `status`, `attribution_window_days`, `hold_days`, `currency`, `starts_at`, `created_at`)
VALUES ('affiliate-v1-default', 1, 'DRAFT', 30, 7, 'VND', 0, 0);
INSERT INTO `affiliate_policy_tiers` (`id`, `policy_version_id`, `tier_code`, `min_qualified_conversions`, `rate_bps`, `created_at`)
VALUES
  ('affiliate-v1-default-tier-1', 'affiliate-v1-default', 'TIER_1', 0, 1000, 0),
  ('affiliate-v1-default-tier-2', 'affiliate-v1-default', 'TIER_2', 10, 2000, 0),
  ('affiliate-v1-default-tier-3', 'affiliate-v1-default', 'TIER_3', 30, 3000, 0);
