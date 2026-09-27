CREATE TABLE member_credit_adjustment_reads (
  account_id text NOT NULL,
  adjustment_key text NOT NULL,
  read_at integer NOT NULL,
  PRIMARY KEY (account_id, adjustment_key),
  FOREIGN KEY (account_id) REFERENCES credit_accounts(id) ON UPDATE no action ON DELETE cascade,
  CHECK (length(trim(adjustment_key)) > 0),
  CHECK (read_at >= 0)
);
--> statement-breakpoint
CREATE INDEX member_credit_adjustment_reads_account_read_idx ON member_credit_adjustment_reads (account_id, read_at);
