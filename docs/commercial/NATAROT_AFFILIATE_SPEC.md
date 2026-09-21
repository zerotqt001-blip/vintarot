# NaTarot — Affiliate Attribution and Commission Specification V1

**Status:** DOCUMENTATION-ONLY / DESIGNED / NOT IMPLEMENTED / NOT DEPLOYED
**Date:** 2026-09-21
**Commercial prerequisite:** a verified order fulfillment event from the Credits/VIP/payment boundary

This document defines a first-party direct-referral system. It does not implement an affiliate network, multi-level marketing, payout transfer, invasive fingerprinting, or a frontend-controlled commission total.

## 1. Core decision

Affiliate attribution is a durable server-side relationship that may begin with an anonymous referral visit but becomes commercially meaningful only after a trusted member identity and a verified fulfillment:

~~~text
referral code/link
  → opaque attribution candidate
  → trusted member attachment
  → server-created order
  → verified payment
  → Credits/VIP fulfillment
  → conversion
  → commission ledger
  → refund window / approval
  → available commission
  → reviewed payout
~~~

Cookies, query strings, local storage, and browser success pages are continuity signals. None is sufficient by itself to create a conversion or commission.

## 2. Evidence and non-goals

### 2.1 Verified inputs

- The current Integration V1 identity boundary derives a trusted member owner from the server session.
- The Credits/VIP architecture defines ORDER_FULFILLED as the future commercial event consumed by affiliate logic.
- The current product has no affiliate account, attribution, conversion, commission, tier, or payout runtime.
- The earlier share/affiliate architecture research recommends a direct-referral, verified-payment-event-driven ledger and leaves rates, thresholds, payout, refund, and privacy policy to human decisions.

### 2.2 Non-goals

- No affiliate runtime implementation in this mission.
- No commission percentage or threshold is activated.
- No final attribution or refund window is invented.
- No automatic bank transfer or payout provider is selected.
- No multi-level/downline commission is designed.
- No invasive device fingerprinting is introduced.
- No affiliate logic may grant Credits/VIP or mutate an order.

## 3. Concepts and ownership

| Concept | Meaning | Source of authority |
| --- | --- | --- |
| Affiliate account | Authenticated member who has an approved referral identity | Member identity plus affiliate status |
| Referral code | Public, revocable code associated with an affiliate account | Server-owned unique code row |
| Attribution candidate | A referral touch associated with an opaque visitor/session token | Server-side row; browser only holds an opaque token |
| Attached attribution | Candidate linked to a trusted member account at registration/login or another approved identity event | Server auth boundary |
| Order | Versioned package purchase intent | Commercial order domain |
| Verified fulfillment | Credits/VIP value successfully applied exactly once | Fulfillment boundary |
| Conversion | A policy-approved link between one attached attribution and one verified fulfillment | Affiliate conversion domain |
| Commission | A liability derived from a conversion and a versioned rule | Append-only commission ledger |
| Payout | Reviewed settlement claim over available commission | Payout/admin boundary |

## 4. Attribution lifecycle

### 4.1 Candidate lifecycle

| State | Meaning | Transition |
| --- | --- | --- |
| CANDIDATE | Referral code was valid at a server endpoint and an opaque visit/session token was issued | ATTACHED, EXPIRED, REJECTED |
| ATTACHED | Candidate was associated with a trusted member ID | CONVERTED, EXPIRED, REVOKED |
| CONVERTED | At least one eligible order fulfillment consumed the attribution | terminal for that conversion; the member may have later conversions under policy |
| EXPIRED | Attribution window elapsed before trusted attachment/conversion | terminal |
| REJECTED | Code invalid, affiliate disabled, self-referral, policy conflict, or integrity failure | terminal |
| REVOKED | Support/admin removed attribution under an auditable policy | terminal for automatic processing |

### 4.2 Recommended V1 policy

The recommended initial policy is:

- first eligible attribution wins;
- the candidate must be recorded while the referral code is active and before its configured expiry;
- attachment happens only through a trusted registration/login/account-link event;
- once attached to a member, a later referral code cannot replace it automatically;
- one order can create at most one conversion in V1;
- one member may have multiple fulfilled orders and therefore multiple conversions only when the approved program policy allows it;
- a code is revocable for future attribution but does not erase historical conversions;
- no conversion is created for an order that is merely CREATED, PENDING, or browser-reported successful.

First-touch vs last-touch, replacement before signup, and repeat-purchase eligibility are business decisions. If the business selects a different policy, the policy version must be stored on attribution and conversion rows so historical outcomes remain reproducible.

### 4.3 Anonymous visitor and different browser

An anonymous browser receives only a high-entropy opaque attribution token. The token must not contain or encode:

- member ID;
- affiliate ID;
- email or phone;
- order amount;
- commission rate;
- package/VIP data;
- private Tarot data.

If a user later logs in or registers in another browser, the server can use the member session to find an already attached attribution. A different browser cannot claim an anonymous candidate merely by submitting a code or copying a cookie. Retroactive manual attachment requires an auditable policy and an administrator action.

### 4.4 Referral replacement

Automatic replacement is disabled in the recommended V1 policy. Before trusted attachment, multiple candidates may exist, but the selection algorithm must be deterministic and policy-versioned. After attachment, switching requires a support/admin command with:

- actor and role;
- reason;
- original and replacement affiliate IDs;
- effective time;
- affected conversion/order scope;
- idempotency key;
- commission reversal/reissue decision.

## 5. Identity and anti-abuse rules

### 5.1 Self-referral

Reject when the affiliate member and referred member are the same trusted member. Do not create a conversion and record a non-sensitive rejection reason.

Additional household, shared-device, shared-payment-identity, and related-account rules require human/legal approval. They must not be approximated by invasive fingerprinting.

### 5.2 Multiple accounts

The system must prevent identity confusion, not attempt to infer a person from a browser fingerprint. Controls include:

- verified member identity and account status;
- unique email/username/phone constraints already present in the member domain;
- no client-controlled member IDs;
- one order/conversion identity per trusted order and fulfillment;
- rate limits and review queues for repeated accounts/referrals;
- optional provider/customer identity comparison only if lawful, documented, and available from the verified payment contract;
- admin review for suspicious patterns, not automatic invasive collection.

### 5.3 Cookie manipulation

The opaque attribution token is untrusted input. The server resolves it to a row, checks active status, expiry, affiliate status, and policy version, and never trusts fields carried in the browser. Tampering yields no attribution.

### 5.4 Cross-user access

All affiliate/member endpoints derive the current member from the trusted session. Path IDs, referral codes, order IDs, conversion IDs, ledger IDs, and payout IDs are authorization inputs, not proof of ownership. Queries include the server-derived affiliate/member predicate and return a safe not-found result for another user’s object.

## 6. Verified conversion contract

### 6.1 Input boundary

The conversion consumer accepts only a trusted internal event:

~~~text
ORDER_FULFILLED {
  orderId,
  fulfillmentId,
  memberId,
  packageVersionId,
  immutablePackageSnapshot,
  fulfillmentTimestamp,
  sourcePaymentEventId,
}
~~~

It rejects:

- browser success/cancel redirects;
- client package/amount data;
- an unverified SePay IPN;
- a PAID order without a successful fulfillment;
- an order ID supplied without a server-loaded fulfillment;
- duplicate or conflicting fulfillment identity.

### 6.2 Conversion checks

For each fulfillment:

1. Load the trusted member and any attached active attribution.
2. Verify the attribution policy window and affiliate account status at the relevant event time.
3. Reject self-referral and other explicitly disallowed relationships.
4. Verify the order is the same order bound to the fulfillment and package snapshot.
5. Verify the order has no existing conversion under the V1 uniqueness rule.
6. Select the effective tier/rule version by server time and qualification policy.
7. Snapshot the commissionable base and rule inputs; do not recalculate from the current package.
8. Insert one conversion and its pending commission entry transactionally.
9. Emit safe audit metadata for the conversion decision.

If any check is ambiguous, mark for manual review and do not create an available commission.

### 6.3 Conversion states

| State | Meaning |
| --- | --- |
| PENDING | Fulfillment is trusted but the refund/approval hold has not completed |
| APPROVED | Policy checks passed and the commission is approved for availability processing |
| AVAILABLE | Commission may be claimed by a payout request |
| REVERSED | A refund, chargeback, fraud decision, or support correction created a compensating entry |
| REJECTED | The conversion failed policy checks and cannot be paid |

## 7. Commission ledger

### 7.1 Source of truth

Commission is ledger-based. The system must not use a mutable shortcut such as:

~~~text
affiliate.totalCommission += amount
~~~

A display total may be materialized, but it must be rebuildable from immutable ledger rows and their linked conversion/order/fulfillment records.

### 7.2 Required traceability

Every commission ledger row includes:

- affiliate account;
- referred member;
- conversion ID;
- internal order ID;
- verified fulfillment ID;
- selected tier/rule version and policy snapshot;
- signed amount and currency;
- lifecycle/event type;
- source/actor;
- stable idempotency key;
- effective and creation timestamps;
- reversal/adjustment link when applicable.

### 7.3 Lifecycle semantics

The append-only journal uses immutable entries and linked lifecycle markers:

| Lifecycle | Meaning |
| --- | --- |
| PENDING | Commission earned from a trusted conversion but held for refund/fraud review |
| APPROVED | Policy review/automatic checks passed |
| AVAILABLE | Eligible for a payout claim |
| PAID | A reviewed payout settlement is recorded |
| REVERSED | A compensating negative entry cancels or claws back a prior commission |

Each transition is idempotent. Historical positive earning rows remain unchanged. A refund/chargeback appends a reversal linked to the original commission, even if the payout was already requested; the policy determines whether a negative available balance, hold, or support adjustment is required.

### 7.4 Commission base

The future tier/rule version must define whether commission is calculated on:

- gross package amount;
- net amount after discount;
- amount excluding tax/payment fees;
- a fixed eligible base;
- or another approved basis.

The selected basis and resulting amount are snapshotted on the conversion. A later package price or tier change cannot rewrite history.

## 8. Versioned tier engine

### 8.1 Interface

The tier engine resolves a versioned rule:

~~~text
resolveAffiliateTier({
  affiliateId,
  qualificationPeriod,
  metricSnapshot,
  effectiveAt,
}) → {
  tierVersionId,
  rateBps,
  commissionBasis,
  policySnapshot,
}
~~~

### 8.2 Required configuration

affiliate_tier_versions must carry:

- human-readable tier name;
- rate in integer basis points;
- qualification period type and boundaries;
- metric type, such as approved fulfilled order count or approved net amount;
- threshold/range configuration;
- effective start/end;
- status and publication actor;
- policy version.

The business direction mentions rates around 10%, 20%, and 30% maximum. Those numbers are not seeded or treated as final policy by this mission. No guessed monthly thresholds are hard-coded.

### 8.3 Historical reproducibility

At conversion time, store both the selected tier version ID and the exact rule snapshot used. If a tier version is later retired, existing conversions remain reproducible. A retroactive tier rewrite requires a separately audited adjustment, not a silent recalculation.

## 9. Proposed data contracts

No migration is created. The logical schema is:

| Table | Required relationships and uniqueness |
| --- | --- |
| affiliate_accounts | One active affiliate identity per member; unique public referral code; status and policy version |
| affiliate_attributions | Affiliate FK; opaque visitor token hash; nullable member FK until trusted attachment; first/last touch; expiry; attribution policy snapshot; indexes by visitor/member/affiliate/expiry |
| affiliate_conversions | Attribution, affiliate, referred member, order, fulfillment FKs; UNIQUE(order_id) for V1; immutable commissionable base and rule snapshot |
| commission_ledger | Append-only rows linked to affiliate, conversion, order, fulfillment, tier version; unique idempotency key; reversal linkage; no cascade delete |
| affiliate_tier_versions | Versioned metric/rate/threshold/effective dates; no mutable historical rule |
| payouts | Affiliate FK; amount/currency; payout claim key; requested/reviewed/settled status; links to ledger claims; no arbitrary frontend amount |
| commercial_admin_audit | Actor, action, target, reason, idempotency, safe before/after hash/snapshot, timestamp |

Foreign-key deletes are restrictive for financial and attribution history. Personal data removal is a future pseudonymization/retention decision.

## 10. Payout boundary

Payout does not move money in V1. It manages an auditable claim over AVAILABLE commission:

~~~text
AVAILABLE commission
  → REQUESTED
  → UNDER_REVIEW
  → APPROVED
  → PAID
~~~

Allowed alternatives are REJECTED or CANCELLED, which release the claim. The system must reserve/claim only available ledger-derived value, reject double claims, and append a PAID/settlement event only when a future payment operator confirms settlement.

The payout destination, minimum, cadence, tax handling, currency, provider, and manual-review authority are human decisions.

## 11. Minimum functional surfaces

Final visual design is out of scope. Future functional surfaces need only expose:

- referral code/link creation and disable state;
- attribution status and qualifying orders without exposing other members’ data;
- conversion history and status;
- commission ledger/history with pending/approved/available/paid/reversed states;
- payout request and review state;
- admin reconciliation and audit view.

Affiliate dashboards must not reveal a referred member’s email, phone, raw IP, full user-agent, private Tarot question, or other private data unless a separate privacy review authorizes it.

## 12. Test strategy

### 12.1 Pure policy tests

- first-touch/expiry policy;
- invalid/disabled code;
- replacement policy and policy-version selection;
- self-referral rejection;
- repeat-purchase policy;
- tier selection at period boundaries;
- commission basis and integer rounding;
- historical rule snapshot immutability.

### 12.2 Persistence/security tests

- visitor token cannot be forged into another affiliate;
- cross-member attribution/conversion/ledger/payout access is denied;
- duplicate fulfillment creates one conversion;
- duplicate conversion event creates one commission;
- conflicting order or fulfillment identity is rejected;
- no direct balance/commission mutation bypasses the ledger;
- admin adjustment requires actor/reason/reference/idempotency/audit.

### 12.3 Failure and concurrency tests

- payment event arrives before browser return;
- browser return arrives without payment event;
- payment event is duplicated or delayed;
- refund arrives before conversion approval;
- refund arrives after payout request;
- two fulfillment consumers race;
- two payout requests race for the same available value;
- transient database retry repeats the same idempotency key only.

## 13. Human decision register

The following remain open and must be decided before affiliate runtime activation:

1. attribution window and first/last-touch rule;
2. whether repeat purchases qualify;
3. whether referral can attach at signup only or also at later login;
4. self-referral, household, related-account, and shared-payment policy;
5. commissionable amount basis and rounding;
6. pending/refund holding period;
7. tier metrics, thresholds, rates, maximum, and effective-date policy;
8. minimum payout, schedule, currency, provider, tax, and clawback policy;
9. data retention, deletion, export, consent, and affiliate dashboard privacy;
10. admin role, review authority, and support escalation.

## 14. Current status

| Area | State |
| --- | --- |
| First-party direct referral model | DESIGNED |
| Trusted fulfillment input | CONTRACTED; depends on payment/Credits/VIP milestones |
| Attribution runtime | NOT IMPLEMENTED |
| Conversion runtime | NOT IMPLEMENTED |
| Commission ledger runtime | NOT IMPLEMENTED |
| Tier configuration | PROPOSED; no rates/thresholds activated |
| Dashboard | NOT IMPLEMENTED |
| Payout transfer | OUT OF SCOPE / NOT IMPLEMENTED |
| Admin mutations | BOUNDARY DESIGNED; NOT IMPLEMENTED |
