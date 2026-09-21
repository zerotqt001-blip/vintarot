CREATE TABLE `commercial_payment_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `provider` text NOT NULL,
  `environment` text NOT NULL,
  `invoice_number` text NOT NULL,
  `request_fingerprint` text NOT NULL,
  `status` text DEFAULT 'PENDING' NOT NULL,
  `provider_order_id` text,
  `expires_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (`provider` = 'sepay'),
  CHECK (`environment` IN ('sandbox', 'production')),
  CHECK (`status` IN ('PENDING', 'VERIFIED', 'FULFILLED', 'VOIDED', 'CANCELLED')),
  CHECK (length(trim(`invoice_number`)) > 0)
);
CREATE UNIQUE INDEX `commercial_payment_attempts_order_unique` ON `commercial_payment_attempts` (`order_id`);
CREATE UNIQUE INDEX `commercial_payment_attempts_invoice_unique` ON `commercial_payment_attempts` (`provider`, `environment`, `invoice_number`);
CREATE INDEX `commercial_payment_attempts_provider_order_idx` ON `commercial_payment_attempts` (`provider`, `environment`, `provider_order_id`);
CREATE INDEX `commercial_payment_attempts_status_idx` ON `commercial_payment_attempts` (`status`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `commercial_payment_events` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text,
  `provider` text NOT NULL,
  `environment` text NOT NULL,
  `provider_event_key` text NOT NULL,
  `provider_order_id` text NOT NULL,
  `provider_invoice_number` text NOT NULL,
  `provider_transaction_id` text NOT NULL,
  `notification_type` text NOT NULL,
  `provider_order_status` text NOT NULL,
  `provider_transaction_status` text NOT NULL,
  `provider_transaction_type` text NOT NULL,
  `amount_minor` integer NOT NULL,
  `currency` text NOT NULL,
  `source` text NOT NULL,
  `payload_hash` text NOT NULL,
  `verification_status` text NOT NULL,
  `rejection_code` text,
  `received_at` integer NOT NULL,
  `verified_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
  CHECK (`provider` = 'sepay'),
  CHECK (`environment` IN ('sandbox', 'production')),
  CHECK (`notification_type` IN ('ORDER_PAID', 'TRANSACTION_VOID')),
  CHECK (`amount_minor` >= 0),
  CHECK (`currency` = 'VND'),
  CHECK (`source` IN ('ipn', 'reconciliation')),
  CHECK (`verification_status` IN ('VERIFIED', 'REJECTED', 'VOIDED'))
);
CREATE UNIQUE INDEX `commercial_payment_events_provider_key_unique` ON `commercial_payment_events` (`provider`, `environment`, `provider_event_key`);
CREATE UNIQUE INDEX `commercial_payment_events_transaction_unique` ON `commercial_payment_events` (`provider`, `environment`, `provider_transaction_id`) WHERE `provider_transaction_id` IS NOT NULL;
CREATE INDEX `commercial_payment_events_order_idx` ON `commercial_payment_events` (`order_id`, `created_at`);
CREATE INDEX `commercial_payment_events_status_idx` ON `commercial_payment_events` (`verification_status`, `created_at`);
--> statement-breakpoint
ALTER TABLE `order_fulfillments` ADD COLUMN `payment_event_id` text;
ALTER TABLE `order_fulfillments` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX `order_fulfillments_payment_event_unique` ON `order_fulfillments` (`payment_event_id`) WHERE `payment_event_id` IS NOT NULL;
