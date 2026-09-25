ALTER TABLE `referral_codes` ADD COLUMN `public_code` text;
CREATE UNIQUE INDEX `referral_codes_public_code_unique`
  ON `referral_codes` (`public_code`)
  WHERE `public_code` IS NOT NULL;
CREATE UNIQUE INDEX `referral_codes_dashboard_profile_unique`
  ON `referral_codes` (`affiliate_profile_id`)
  WHERE `status` = 'ACTIVE' AND `source` = 'natarot-dashboard-v1';
