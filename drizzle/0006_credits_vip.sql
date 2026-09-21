CREATE TABLE `credit_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_kind` text NOT NULL,
  `owner_id` text NOT NULL,
  `mutation_version` integer DEFAULT 0 NOT NULL,
  `mutation_token` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CHECK (`owner_kind` IN ('member', 'guest')),
  CHECK (length(trim(`owner_id`)) > 0),
  CHECK (`mutation_version` >= 0)
);
CREATE UNIQUE INDEX `credit_accounts_owner_unique` ON `credit_accounts` (`owner_kind`, `owner_id`);
CREATE INDEX `credit_accounts_mutation_idx` ON `credit_accounts` (`mutation_version`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `packages` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name_en` text NOT NULL,
  `name_vi` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CHECK (`active` IN (0, 1))
);
CREATE UNIQUE INDEX `packages_slug_unique` ON `packages` (`slug`);
CREATE INDEX `packages_active_idx` ON `packages` (`active`, `slug`);
--> statement-breakpoint
CREATE TABLE `package_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `package_id` text NOT NULL,
  `version` integer NOT NULL,
  `amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `credit_units` integer NOT NULL,
  `vip_duration_seconds` integer,
  `benefit_snapshot` text NOT NULL,
  `policy_version` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `starts_at` integer NOT NULL,
  `ends_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`version` > 0),
  CHECK (`amount_minor` >= 0),
  CHECK (`credit_units` >= 0),
  CHECK (`vip_duration_seconds` IS NULL OR `vip_duration_seconds` > 0),
  CHECK (`ends_at` IS NULL OR `ends_at` > `starts_at`),
  CHECK (`status` IN ('draft', 'active', 'retired'))
);
CREATE UNIQUE INDEX `package_versions_package_version_unique` ON `package_versions` (`package_id`, `version`);
CREATE INDEX `package_versions_catalog_idx` ON `package_versions` (`status`, `starts_at`, `ends_at`);
--> statement-breakpoint
CREATE TABLE `credit_grants` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `source` text NOT NULL,
  `source_type` text,
  `source_id` text,
  `grant_key` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `units` integer NOT NULL,
  `available_units` integer NOT NULL,
  `eligible_from` integer NOT NULL,
  `expires_at` integer,
  `policy_version` text NOT NULL,
  `policy_snapshot` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `credit_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`source` IN ('PURCHASE', 'VIP_GRANT', 'PROMOTION', 'TRIAL', 'REFUND', 'ADMIN', 'MIGRATION')),
  CHECK (`units` > 0),
  CHECK (`available_units` >= 0 AND `available_units` <= `units`),
  CHECK (`expires_at` IS NULL OR `expires_at` > `eligible_from`)
);
CREATE UNIQUE INDEX `credit_grants_account_key_unique` ON `credit_grants` (`account_id`, `grant_key`);
CREATE INDEX `credit_grants_eligible_idx` ON `credit_grants` (`account_id`, `eligible_from`, `expires_at`, `created_at`);
CREATE INDEX `credit_grants_source_idx` ON `credit_grants` (`source`, `source_type`, `source_id`);
--> statement-breakpoint
CREATE TABLE `credit_ledger` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `grant_id` text,
  `reservation_id` text,
  `event_type` text NOT NULL,
  `units` integer NOT NULL,
  `reference_type` text,
  `reference_id` text,
  `idempotency_key` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `actor_kind` text,
  `actor_id` text,
  `reason` text NOT NULL,
  `effective_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `reversed_entry_id` text,
  FOREIGN KEY (`account_id`) REFERENCES `credit_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`grant_id`) REFERENCES `credit_grants`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`event_type` IN ('GRANT', 'CONSUME', 'REFUND', 'EXPIRATION', 'ADJUSTMENT', 'REVERSAL')),
  CHECK (`units` <> 0),
  CHECK (`actor_kind` IS NULL OR `actor_kind` IN ('member', 'system', 'admin'))
);
CREATE UNIQUE INDEX `credit_ledger_account_key_unique` ON `credit_ledger` (`account_id`, `idempotency_key`);
CREATE INDEX `credit_ledger_account_created_idx` ON `credit_ledger` (`account_id`, `created_at`, `id`);
CREATE INDEX `credit_ledger_grant_idx` ON `credit_ledger` (`grant_id`, `created_at`);
CREATE INDEX `credit_ledger_reference_idx` ON `credit_ledger` (`reference_type`, `reference_id`);
--> statement-breakpoint
CREATE TABLE `credit_reservations` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `usage_type` text NOT NULL,
  `units` integer NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `status` text DEFAULT 'PENDING' NOT NULL,
  `lease_expires_at` integer,
  `retry_count` integer DEFAULT 0 NOT NULL,
  `result_type` text,
  `result_id` text,
  `reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `consumed_at` integer,
  `released_at` integer,
  FOREIGN KEY (`account_id`) REFERENCES `credit_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`units` > 0),
  CHECK (`status` IN ('PENDING', 'RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  CHECK (`retry_count` >= 0)
);
CREATE UNIQUE INDEX `credit_reservations_owner_key_unique` ON `credit_reservations` (`account_id`, `idempotency_key`);
CREATE INDEX `credit_reservations_owner_status_idx` ON `credit_reservations` (`account_id`, `status`, `updated_at`);
CREATE INDEX `credit_reservations_lease_idx` ON `credit_reservations` (`status`, `lease_expires_at`);
--> statement-breakpoint
CREATE TABLE `credit_reservation_allocations` (
  `id` text PRIMARY KEY NOT NULL,
  `reservation_id` text NOT NULL,
  `grant_id` text NOT NULL,
  `held_units` integer NOT NULL,
  `consumed_units` integer DEFAULT 0 NOT NULL,
  `released_units` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`reservation_id`) REFERENCES `credit_reservations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`grant_id`) REFERENCES `credit_grants`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`held_units` > 0),
  CHECK (`consumed_units` >= 0 AND `consumed_units` <= `held_units`),
  CHECK (`released_units` >= 0 AND `released_units` <= `held_units`),
  CHECK (`consumed_units` + `released_units` <= `held_units`)
);
CREATE UNIQUE INDEX `credit_reservation_allocations_reservation_grant_unique` ON `credit_reservation_allocations` (`reservation_id`, `grant_id`);
CREATE INDEX `credit_reservation_allocations_grant_idx` ON `credit_reservation_allocations` (`grant_id`, `reservation_id`);
--> statement-breakpoint
CREATE TABLE `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `package_id` text NOT NULL,
  `package_version_id` text NOT NULL,
  `package_snapshot` text NOT NULL,
  `amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `status` text DEFAULT 'PENDING' NOT NULL,
  `idempotency_key` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `payment_reference` text,
  `created_at` integer NOT NULL,
  `payment_confirmed_at` integer,
  `fulfilled_at` integer,
  `cancelled_at` integer,
  `refunded_at` integer,
  FOREIGN KEY (`account_id`) REFERENCES `credit_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`package_version_id`) REFERENCES `package_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`amount_minor` >= 0),
  CHECK (`status` IN ('PENDING', 'PAYMENT_CONFIRMED', 'FULFILLED', 'CANCELLED', 'REFUNDED'))
);
CREATE UNIQUE INDEX `orders_account_key_unique` ON `orders` (`account_id`, `idempotency_key`);
CREATE UNIQUE INDEX `orders_payment_reference_unique` ON `orders` (`payment_reference`) WHERE `payment_reference` IS NOT NULL;
CREATE INDEX `orders_account_status_idx` ON `orders` (`account_id`, `status`, `created_at`);
CREATE INDEX `orders_package_idx` ON `orders` (`package_id`, `package_version_id`);
--> statement-breakpoint
CREATE TABLE `entitlements` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `entitlement_type` text NOT NULL,
  `benefit_version` text NOT NULL,
  `starts_at` integer NOT NULL,
  `ends_at` integer,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text NOT NULL,
  `grant_key` text NOT NULL,
  `benefit_snapshot` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `cancelled_at` integer,
  FOREIGN KEY (`account_id`) REFERENCES `credit_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`ends_at` IS NULL OR `ends_at` > `starts_at`),
  CHECK (`status` IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'))
);
CREATE UNIQUE INDEX `entitlements_account_key_unique` ON `entitlements` (`account_id`, `grant_key`);
CREATE INDEX `entitlements_account_status_idx` ON `entitlements` (`account_id`, `entitlement_type`, `status`, `ends_at`);
CREATE INDEX `entitlements_source_idx` ON `entitlements` (`source_type`, `source_id`);
--> statement-breakpoint
CREATE TABLE `order_fulfillments` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `fulfillment_key` text NOT NULL,
  `result_snapshot` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE UNIQUE INDEX `order_fulfillments_order_unique` ON `order_fulfillments` (`order_id`);
CREATE UNIQUE INDEX `order_fulfillments_key_unique` ON `order_fulfillments` (`fulfillment_key`);
--> statement-breakpoint
CREATE TABLE `commercial_events` (
  `id` text PRIMARY KEY NOT NULL,
  `event_type` text NOT NULL,
  `aggregate_type` text NOT NULL,
  `aggregate_id` text NOT NULL,
  `payload` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `commercial_events_key_unique` ON `commercial_events` (`idempotency_key`);
CREATE INDEX `commercial_events_aggregate_idx` ON `commercial_events` (`aggregate_type`, `aggregate_id`, `created_at`);
