CREATE TABLE `business_reporting_row_state_campaigns` (
  `sheet_name` text NOT NULL,
  `row_key` text NOT NULL,
  `row_number` integer NOT NULL,
  `row_hash` text NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`sheet_name`, `row_key`),
  UNIQUE (`sheet_name`, `row_number`),
  CHECK (`sheet_name` IN ('Dashboard', 'Customers', 'Revenue', 'Affiliate', 'Referrals', 'Activity', 'Credits', 'Campaigns', 'System')),
  CHECK (`row_number` >= 2),
  CHECK (length(`row_hash`) = 64)
);
INSERT INTO `business_reporting_row_state_campaigns` (`sheet_name`, `row_key`, `row_number`, `row_hash`, `updated_at`)
  SELECT `sheet_name`, `row_key`, `row_number`, `row_hash`, `updated_at` FROM `business_reporting_row_state`;
DROP TABLE `business_reporting_row_state`;
ALTER TABLE `business_reporting_row_state_campaigns` RENAME TO `business_reporting_row_state`;
