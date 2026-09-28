# NaTarot Marketing Campaign Manager

## Goal

Let an authorized Owner manage credit campaigns in NaTarot Admin while using the existing Credit accounts, grants, reservations, ledger, and consumption rules. The first delivered claim campaign is Daily Rewards, created in `PAUSED` state. The current one-credit registration bonus becomes an Admin-managed Welcome Bonus only after a parity test proves that signup behavior is unchanged.

## Existing behavior to preserve

- Password and Google signup currently create a `TRIAL` grant for one unit in the same database batch as the new member.
- The signup grant key is `signup-trial:v1`, `source_type` is `SIGNUP_TRIAL`, `source_id` is the member id, and there is no expiry.
- Existing grants, ledger entries, account balances, and the signup behavior must remain untouched until the new path passes exact equivalence tests. Those tests now pass; the seeded configuration reproduces the same one-unit, non-expiring TRIAL grant in the same member-creation batch.
- The canonical ledger already enforces grant and ledger idempotency. Consumption already allocates the earliest-expiring eligible lot first and excludes expired lots. Campaign logic must not allocate or consume credits itself.
- Current member APIs and AI usage resolve a member Credit owner as `member:<member-id>`, while the existing signup grant helper passes the raw member id. Preserve the existing signup grant owner key exactly; new Daily Rewards grants use the member API's canonical prefixed owner. Do not reconcile or move historical grants without an audited production inventory and an explicit balance-preserving procedure.
- Affiliate commissions are based on verified fulfilled orders. Campaign grants must never create an order or an affiliate conversion.

## Data model

Add campaign metadata and claim records; do not create a wallet or a second credit ledger.

`marketing_campaigns` stores the campaign name/type, reward units, scheduled start/end, IANA time zone, eligibility rule, claim frequency, expiry duration, optional total-unit budget, per-user claim limit, current state, units issued, and timestamps. `budget_used_units` is a monotonic total of units granted; expiry and redemption do not replenish campaign budget. An unset budget means unlimited and is needed to preserve the uncapped signup bonus.

`marketing_campaign_claims` stores only campaign id, member id, local claim period, claim timestamp, units, and the canonical grant id. A unique `(campaign_id, member_id, claim_period)` constraint backs one-time and daily idempotency. `member_id` is internal operational data and never appears in Business Control Center exports.

Seed two records:

- **Welcome Bonus**: `ACTIVE`, one `TRIAL` unit once per new member, no expiry, no end date, no budget. Seed its issued-unit counter from the existing `SIGNUP_TRIAL` grants without modifying those grants.
- **Daily Rewards**: `PAUSED`, one `PROMOTION` unit per local day, Asia/Ho_Chi_Minh, seven-day expiry, a 10,000-unit budget, and no campaign end date. This is a safe, bounded draft; it remains inactive until the Owner explicitly activates it.

Every grant stores a policy snapshot with the campaign id and the reward/expiry configuration used at issue time. Editing a campaign affects future claims only.

## Campaign rules

- Campaign types are Welcome Bonus, Daily Rewards, and a managed custom promotion. Supported claim frequencies are once, daily, weekly, and monthly; phase-one claim UI/API supports Welcome Bonus during signup and Daily Rewards through an authenticated member claim.
- Eligibility is server evaluated. Claimable rewards require a current session and an enabled, verified member record. The client cannot select the member, claim period, reward amount, expiry, budget, or grant key.
- A claim period is derived on the server from the campaign time zone and configured frequency: one-time, local calendar day, ISO week, or calendar month. Asia/Ho_Chi_Minh is the default; IANA daylight-saving changes are respected where applicable.
- Start is inclusive and end is exclusive. A claim requires state `ACTIVE` and `start_at <= now < end_at` when an end is configured. An elapsed scheduled end is reported as `ENDED`; a paused campaign cannot issue a claim.
- Admin is guarded by the existing live-role permission check. `admin.marketing.manage` is granted only to `SUPER_ADMIN` in this release. Mutations are audited with a before/after configuration snapshot and a request idempotency key.
- Welcome Bonus starts with the exact existing signup configuration. After parity is verified, a `SUPER_ADMIN` may explicitly change its future signup reward or status through the audited Admin manager, as authorized by the Owner; this implementation does not change the running production configuration or any existing grants.
- A budget change cannot set the total below units already issued. Claim and budget increments happen in one D1 transaction. Database constraints and conditional writes—not browser state—enforce the claim period, per-user limit, and remaining budget.

## Atomic claim and grant

For a claim, calculate the local period and deterministic claim/grant keys server side. In one `database.batch`, conditionally reserve the reward units only if the campaign is active, scheduled, eligible, under its per-user limit and budget, and has no claim for this member and period. Insert the unique claim record from that successful reservation, then call the canonical `prepareGrantCreditsStatements` with a claim-row guard. The existing helper writes `credit_grants` and `credit_ledger`; the campaign claim is linked to that grant in the same batch. The handler then reads the persisted claim and returns either the existing successful result or a safe status (paused/not eligible/already claimed/budget exhausted). Concurrent requests and replays cannot spend the budget twice or create another ledger entry.

The welcome signup path uses the seeded configuration after the parity suite verifies password and Google signup, same-batch rollback, key/source/amount/expiry, duplicate registration, and untouched prior grants. Its initial configuration grants exactly the current `TRIAL` lot, including its existing account-owner key. A later Welcome configuration change affects future registrations only and is an explicit audited Owner action. The production audit must confirm that this legacy owner-key difference is understood before the Welcome Bonus cutover; this feature does not rewrite old accounts or grants.

## Credit expiry and consumption safety

- Purchased and promotional credits remain lots in the canonical ledger. Daily campaign grants use `source=PROMOTION`; the signup bonus remains `source=TRIAL` for compatibility.
- The existing allocation order remains earliest-expiring first; non-expiring lots remain last. No custom campaign path changes reservation or AI-reading consumption.
- The existing `expireGrant` method remains the only ledger expiry writer. A server-side scheduled sweep finds due grants and calls it idempotently. A grant excluded from balances at its expiry timestamp stays excluded even if the sweep is delayed.
- The sweep runs at the beginning of the existing 15-minute Business Control Center job, before Google/Sheets dependency checks, and reports its status separately so reporting outages cannot skip expiry.
- A promotional grant produces no revenue, order, or affiliate conversion. Campaign analytics derive redeemed/expired units from ledger events joined to campaign grants.

## Interface

- Admin route: `/admin/marketing/campaigns`; only `SUPER_ADMIN` can open it or call its APIs. It supports create/edit, pause/resume/end, schedule, reward, expiry, budget, per-user limits, audit history, and aggregate outcomes.
- Member route: `/daily-rewards`; it shows available Daily Reward and Custom campaigns, eligibility, claim action, next eligible local period, and Credit expiry. Its responsive styles are scoped to the page and preserve the Moonlight/VinTarot visual language. Tarot Room is unchanged.
- Campaign status and claim results are rendered from server responses. A user who is signed out receives a sign-in path; no claim can be made anonymously.

## Business Control Center analytics

Add an aggregate Campaigns worksheet and typed report rows. Export campaign name/type/status, reward, configured budget, issued units, claimed rewards, redeemed promotional units, expired promotional units, active eligible-account count, repeat claimers, and budget utilization. “Returning users” in this report means members with claims on at least two distinct campaign-local days. No member ids, email addresses, phone numbers, or row-level claim details are exported.

## Verification and deployment gates

Test UTC/local-day boundaries, DST-aware time-zone conversion where applicable, concurrent and replayed claims, schedule pause/resume/end, reward/budget limits, expiry, purchased-lot preservation, AI consumption order, signup parity, admin authorization, commission isolation, and aggregate BCC statistics. Then run the complete existing regression suite, type check, production build, changed-file lint, and diff checks.

Do not apply a production migration, enable Daily Rewards, alter Welcome Bonus behavior, or deploy while the Technical Audit is unresolved. Before a later production release, require an explicit conflict-free audit result, a fresh verified production backup/restore, atomic promotion, production verification, and exactly the current release plus two rollback releases. The shipped Daily Rewards state must remain `PAUSED`.
