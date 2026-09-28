CREATE TABLE `marketing_campaigns` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_type` text NOT NULL,
  `name` text NOT NULL,
  `status` text NOT NULL,
  `reward_units` integer NOT NULL,
  `start_at` integer NOT NULL,
  `end_at` integer,
  `time_zone` text NOT NULL,
  `eligibility_rule` text NOT NULL,
  `claim_frequency` text NOT NULL,
  `credit_expiration_seconds` integer,
  `total_budget_units` integer,
  `per_user_limit` integer,
  `budget_used_units` integer NOT NULL DEFAULT 0,
  `config_version` integer NOT NULL DEFAULT 1,
  `created_by` text,
  `updated_by` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CHECK (`campaign_type` IN ('WELCOME_BONUS', 'DAILY_REWARD', 'CUSTOM')),
  CHECK (`status` IN ('ACTIVE', 'PAUSED', 'ENDED')),
  CHECK (length(trim(`name`)) BETWEEN 1 AND 120),
  CHECK (`reward_units` > 0),
  CHECK (`end_at` IS NULL OR `end_at` > `start_at`),
  CHECK (`eligibility_rule` IN ('NEW_MEMBER', 'ACTIVE_MEMBER')),
  CHECK (`claim_frequency` IN ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY')),
  CHECK (`credit_expiration_seconds` IS NULL OR `credit_expiration_seconds` > 0),
  CHECK (`total_budget_units` IS NULL OR `total_budget_units` > 0),
  CHECK (`per_user_limit` IS NULL OR `per_user_limit` > 0),
  CHECK (`budget_used_units` >= 0),
  CHECK (`config_version` > 0)
);
CREATE INDEX `marketing_campaigns_status_schedule_idx` ON `marketing_campaigns` (`status`, `start_at`, `end_at`);
CREATE INDEX `marketing_campaigns_type_status_idx` ON `marketing_campaigns` (`campaign_type`, `status`);
--> statement-breakpoint
CREATE TABLE `marketing_campaign_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `member_id` text NOT NULL,
  `claim_period` text NOT NULL,
  `credit_grant_id` text,
  `units` integer NOT NULL,
  `claimed_at` integer NOT NULL,
  `expires_at` integer,
  FOREIGN KEY (`campaign_id`) REFERENCES `marketing_campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`credit_grant_id`) REFERENCES `credit_grants`(`id`) ON UPDATE no action ON DELETE restrict,
  UNIQUE (`campaign_id`, `member_id`, `claim_period`),
  UNIQUE (`credit_grant_id`),
  CHECK (`units` > 0),
  CHECK (`expires_at` IS NULL OR `expires_at` > `claimed_at`)
);
CREATE INDEX `marketing_campaign_claims_campaign_time_idx` ON `marketing_campaign_claims` (`campaign_id`, `claimed_at`);
CREATE INDEX `marketing_campaign_claims_member_time_idx` ON `marketing_campaign_claims` (`member_id`, `claimed_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `marketing_campaigns` (
  `id`, `campaign_type`, `name`, `status`, `reward_units`, `start_at`, `end_at`, `time_zone`,
  `eligibility_rule`, `claim_frequency`, `credit_expiration_seconds`, `total_budget_units`,
  `per_user_limit`, `budget_used_units`, `config_version`, `created_by`, `updated_by`, `created_at`, `updated_at`
) VALUES (
  'welcome-bonus-v1', 'WELCOME_BONUS', 'Welcome Bonus', 'ACTIVE', 1, 0, NULL, 'Asia/Ho_Chi_Minh',
  'NEW_MEMBER', 'ONCE', NULL, NULL, 1,
  (SELECT COALESCE(SUM(`units`), 0) FROM `credit_grants` WHERE `source`='TRIAL' AND `source_type`='SIGNUP_TRIAL'),
  1, NULL, NULL, 0, 0
);
INSERT OR IGNORE INTO `marketing_campaigns` (
  `id`, `campaign_type`, `name`, `status`, `reward_units`, `start_at`, `end_at`, `time_zone`,
  `eligibility_rule`, `claim_frequency`, `credit_expiration_seconds`, `total_budget_units`,
  `per_user_limit`, `budget_used_units`, `config_version`, `created_by`, `updated_by`, `created_at`, `updated_at`
) VALUES (
  'daily-rewards-v1', 'DAILY_REWARD', 'Daily Rewards', 'PAUSED', 1, 0, NULL, 'Asia/Ho_Chi_Minh',
  'ACTIVE_MEMBER', 'DAILY', 604800, 10000, NULL, 0, 1, NULL, NULL, 0, 0
);
