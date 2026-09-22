# NaTarot commercial catalog and 30-day Credit validity

## Goal

Publish the owner-approved four-package commercial catalog and make each paid Credit lot expire exactly 30 days after verified fulfillment, while preserving historical package snapshots and isolating owner QA/Admin Credits.

## Scope

- Extend the production-only catalog seed to publish four versioned packages:
  - 1 Credit / 15,000 VND
  - 5 Credits / 69,000 VND
  - 10 Credits / 129,000 VND (popular)
  - 20 Credits / 229,000 VND
- Store the immutable 30-day validity in each package version benefit snapshot.
- Retire the legacy one-package catalog without mutating historical package versions or orders.
- Compute `expires_at` from the fulfillment timestamp, not order creation or payment-confirmation timestamp.
- Display the server-provided validity disclosure in English and Vietnamese before checkout.
- Add regression coverage for catalog identity, pricing, snapshot history, fulfillment-time expiry, idempotent fulfillment, earliest-expiry allocation, expired-credit rejection, and owner QA-credit isolation.

## Safety and deployment

- Use the exact production commit lineage in an isolated worktree.
- Run the complete targeted and repository verification before deployment.
- Take a fresh backup and isolated restore verification immediately before the production database/catalog mutation.
- Seed only `/var/lib/natarot/natarot.sqlite` under explicit production guards; never touch staging.
- Configure SePay production credentials only after the provider account is in Production mode; never print or persist secrets in the repository, logs, screenshots, or chat.
- Do not execute a real bank transfer solely for testing.

## Verification gates

1. Local tests, typecheck, build, lint/diff checks, and production seed contract checks pass.
2. Production backup checksum and isolated restore pass.
3. Production seed reports exactly four active packages/versions and the exact catalog values.
4. Public `/api/packages` reports the same four server-authoritative values and 30-day validity.
5. Checkout form is signed from the selected server package; pending/failed/wrong-amount/replay paths create no duplicate lots.
6. Production SePay IPN/authentication and configuration checks pass without a real money transfer.
7. Final report separates `PRODUCTION CONFIGURATION READY`, `REAL MONEY READY`, and `LIVE BANK TRANSACTION VERIFIED`.
