# NaTarot Account and History V1

## Owner contract

The account surface is for the current authenticated member only. The route derives `member:<id>` from the existing session identity and does not accept a client owner parameter. Guest readings remain under the existing guest contract; they are not silently reassigned to a member by an arbitrary request field.

## Summary and history

`getAccountSummary` returns safe member profile fields, Credits balance/history summary, VIP status, and bounded counts or metadata summaries for readings, shares, orders, and affiliate activity. `listAccountHistory` supports `readings`, `shares`, `orders`, `credits`, `affiliate`, and `all`. It uses a stable `(createdAt,id)` cursor, limits 1–50, and no raw bearer token or Tarot payload in the summary list.

Reading detail continues through the existing owner-gated saved-reading parser and remains the only place that can return the stored reading payload to its owner. Share history contains status and timestamps but not the share token. Order history is provider-neutral and contains package, amount, currency, status, and fulfillment metadata only. Credits and commission history use integer units/minor amounts and explicit status.

## Admin read model

`listAdminOrderReadModel` exposes order ID, status, integer amount, currency, payment reference, confirmation/fulfillment/refund timestamps, fulfillment status, and Credits/VIP result snapshots. It intentionally does not join `reading_payload`, questions, card interpretations, private share tokens, or affiliate fraud-note plaintext. Admin read access is controlled by the RBAC matrix and is not an owner bypass.

## Deletion and privacy semantics

V1 documents the privacy boundary and safe reads. A future account-deletion operation must revoke sessions and shares, handle Tarot-private content according to the retention policy, anonymize or retain commercial/audit facts as required, and preserve compensating accounting history. It must be an explicit domain workflow with tests, not a client-side row deletion. Exports must apply the same classification and redaction rules.

## Functional UI boundary

The account/history panel is a functional verification surface, marked `FUNCTIONAL UI — NOT FINAL DESIGN`. It uses existing shell primitives and links to existing saved-reading detail. It does not redesign Home, Room, Reading Result, Auth, Profile, the Liquid Glass system, or the Moonlight reference aesthetic.
