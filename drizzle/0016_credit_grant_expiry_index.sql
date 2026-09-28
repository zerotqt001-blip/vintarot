CREATE INDEX `credit_grants_expiry_idx`
  ON `credit_grants` (`expires_at`, `id`)
  WHERE `expires_at` IS NOT NULL AND `available_units` > 0;
