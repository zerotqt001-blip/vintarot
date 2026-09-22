# NaTarot RBAC Permission Matrix V1

Authorization is server-side and session-derived. The client cannot select a role, actor, owner, amount, or permission. The current member row is re-read for each privileged request; a disabled member is denied even if an old session exists.

## Roles

The exact roles are `USER`, `SUPPORT`, `FINANCE`, `CONTENT_ADMIN`, `ADMIN`, and `SUPER_ADMIN`.

## Permission matrix

| Permission | USER | SUPPORT | FINANCE | CONTENT_ADMIN | ADMIN | SUPER_ADMIN |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `admin.dashboard.read` |  | ✓ | ✓ |  | ✓ | ✓ |
| `admin.users.read` |  | ✓ | ✓ |  | ✓ | ✓ |
| `admin.users.status` |  | ✓ |  |  | ✓ | ✓ |
| `admin.roles.manage` |  |  |  |  |  | ✓ |
| `admin.sessions.read` |  | ✓ |  |  | ✓ | ✓ |
| `admin.sessions.revoke` |  | ✓ |  |  | ✓ | ✓ |
| `admin.credits.adjust` |  |  | ✓ |  | ✓ | ✓ |
| `admin.vip.adjust` |  |  | ✓ |  | ✓ | ✓ |
| `admin.orders.read` |  | ✓ | ✓ |  | ✓ | ✓ |
| `admin.readings.read` |  |  |  |  | ✓ | ✓ |
| `admin.affiliate.read` |  |  | ✓ |  | ✓ | ✓ |
| `admin.affiliate.manage` |  |  |  |  | ✓ | ✓ |
| `admin.affiliate.adjust` |  |  | ✓ |  | ✓ | ✓ |
| `admin.audit.read` |  |  | ✓ |  | ✓ | ✓ |
| `admin.security.manage` |  |  |  |  |  | ✓ |

`CONTENT_ADMIN` is intentionally not a user, finance, order, affiliate, or security administrator in V1. It remains available for future content-scoped capabilities without granting unrelated access.

## Mutation contract

Every privileged mutation requires:

- a current authenticated actor from the session cookie;
- an opaque target ID validated by the service;
- a non-empty bounded `reason`;
- an `idempotency_key` for retryable status, Credits, VIP, affiliate, or session actions;
- an audit insert with the actor, action, target, reason, and redacted metadata.

The service rejects client role fields, target owner fields, raw payment/provider fields, negative or non-integer monetary amounts, and fields outside the action schema. Support may manage user status and sessions but cannot adjust money, VIP, roles, security, or affiliate policy. Finance may operate commercial read models and adjustments but cannot manage roles or security. Admin may manage ordinary operations but cannot grant roles or change security controls. Only `SUPER_ADMIN` can manage roles and security settings.

## Read boundaries

Admin user and order views are metadata-only. They do not return passwords, session bearer data, raw token hashes, raw referral codes, encrypted note plaintext without a runtime key, questions, reading payloads, card interpretations, or private share tokens. Owners use the existing account predicates for their own readings, shares, orders, Credits, VIP, and affiliate history.
