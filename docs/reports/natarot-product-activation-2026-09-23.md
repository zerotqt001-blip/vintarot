# NaTarot Product Activation Report — 2026-09-23

## Runtime

- Production URL: https://natarot.com
- Deployed runtime branch: codex/natarot-product-activation
- Deployed runtime commit: 9216d4597bc0b4faa9d0cbf0bf60f65c27b0308f
- Active deployment marker: /opt/natarot/DEPLOYMENT_REVISION
- Previous release retained at: /opt/natarot.rollback-natarot-product-activation-20260923-173844-9216d45
- Service: natarot.service, active after a controlled restart
- Health: local and public /api/health returned 200 with status ok

The runtime archive was built from the deployed commit, transferred with a matching SHA-256, installed and built natively on the VPS, migration-dry-run checked against a database clone, and switched atomically. The production archive SHA-256 is cf9760e8002137eaa16760f2920ee3f4cc61cece3ccbd191797f9f8ea0dea54b.

## Commercial catalog

The production catalog contains exactly one active package/version:

- Package slug: tarot-credit-v1
- Display name: 1 Tarot Credit
- Price: 15,000 VND
- Credit grant: 1 Credit
- VIP duration: none
- Active package versions: 1

The public /api/packages endpoint and the authenticated Packages screen both expose this server-owned value. No staging Sandbox credentials or secrets were copied into production.

## Owner QA account

- Username: natarot_owner_test
- Role: ADMIN
- Status: enabled
- Internal grant: 100 Credits, source OWNER_TEST_GRANT
- Internal entitlement: vip-owner-test-v1, permanent internal QA entitlement
- Affiliate profile: provisioned
- Password storage: macOS Keychain service natarot-owner-test-password; the password is not stored in Git, the report, shell output, or the production database in plaintext

One real production owner reading was completed with DeepSeek after login. The account now has 99 available Credits, one saved reading, one active share, and one consumed-credit ledger entry. No order, payment attempt, fulfillment, or fake transaction was created.

## Verification matrix

| Field | Result | Evidence |
|---|---|---|
| Production | PASS | Public health, authenticated browser, and post-restart checks |
| Package catalog | POPULATED | Exactly one active package/version, server-side seed verification |
| Production package | PASS | 1 Tarot Credit = 15,000 VND; 1 Credit; no VIP duration |
| Account → Nạp Credit | PASS | Authenticated Account CTA reaches Packages without typing a URL |
| Package selection | PASS | Server package-version ID reaches Checkout |
| Order creation | PASS / safe gate | Automated contract and authenticated checkout boundary pass; live order intentionally not created without a real provider |
| Checkout | PASS / provider gate | Server-priced Checkout renders the package and “Tạo phiên thanh toán”; provider path returns the safe missing-SePay gate |
| SePay production | SEPAY_PRODUCTION_CREDENTIAL_GATE | No SePay production variable names are present in /etc/natarot.env |
| Real-money checkout | GATE | Requires production SePay credentials and an approved payment test |
| Payment verification | GATE | Requires the production provider callback/IPN contract |
| Idempotency | PASS | Automated order/payment/fulfillment idempotency tests |
| Fulfillment | GATE | Requires a verified provider payment event |
| Credits | PASS | 100 internal grant, then one real Tarot consumption; balance persisted at 99 |
| VIP | PASS | Internal QA entitlement visible with non-commercial provenance |
| Owner test account | PASS | Login, /api/auth/me, Account, Admin and Affiliate dashboard |
| Owner test credits | PASS | 99 available after one live reading |
| Owner test VIP | PASS | vip-owner-test-v1 visible; explicitly marked internal QA |
| Owner can test Tarot without payment | YES | Internal Credits grant authorizes the live reading |
| Test credit consumption | PASS | DeepSeek reading 200; ledger and Account history show -1 Credit |
| Order history | PASS | Empty before purchase; no synthetic order created |
| Reading history | PASS | One saved reading appears in Account history |
| Affiliate public | PASS | Public conversion/policy boundary rendered |
| Affiliate dashboard | PASS | Authenticated owner dashboard rendered; no payout mutation is exposed |
| Admin/RBAC | PASS | Owner ADMIN console rendered; server-side role matrix and protected-route tests pass |
| Google OAuth | PASS / EXTERNAL_GATE | Start endpoint returns 303 to accounts.google.com; interactive Google consent was not automated |
| Resend | RESEND_EXTERNAL_GATE | Existing production verification reported HTTP 401; replace the invalid production key |
| DeepSeek | PASS | Live owner reading returned 200 from deepseek:deepseek-flash with prompt tarot-reading-v4.2.2 |
| Auto topic | PASS | Canonical recommender, Create flow, and automated production-branch coverage |
| Manual topic | PASS | Owner live draw used the canonical everyday spread and selected cards |
| Share/QR | PASS | Share create 201; public page 200; SVG image/QR 200; token remains transient |
| Backup | PASS | Fresh backup natarot-production-20260922-180302; archive SHA-256 d9a6beefa58bdff3194cb642a2af87580d2537b98d3e91d09c16b4e2d75b8206 |
| Restore verification | PASS | Fresh archive extracted to a temporary directory; SQLite integrity ok, zero foreign-key violations, 10 migrations |
| Rollback | READY | Prior app tree retained and deployment marker records its path |
| Full tests | PASS | npx tsx --test tests/*.test.ts: 558/558 |
| TypeScript/build/audit | PASS | npx tsc --noEmit, npm run build, npm audit --omit=dev: 0 vulnerabilities |
| Targeted lint | PASS | Changed-file ESLint has no errors; one inherited unused-parameter warning remains in lib/sqlite-d1.ts |
| Repository-wide lint | BASELINE | Existing legacy/generated lint baseline remains; not introduced by this release |
| 375px | PASS | Account, Packages, Checkout and Affiliate: no horizontal overflow |
| 390px | PASS | Account and Packages screenshots: no horizontal overflow |
| 412px | PASS | Account, Packages, Checkout and Affiliate: no horizontal overflow |
| Desktop | PASS | Account, Packages, Checkout, Order History, Affiliate and Admin browser QA |

## Production screenshots

Fresh production Chrome screenshots were captured inline in the task transcript for:

1. Account with Credit, Nạp Credit CTA, internal VIP and owner identity.
2. Packages showing 1 Tarot Credit for 15,000 VND.
3. Checkout showing the selected package and server-authoritative payment copy.
4. Order History showing the intentionally empty order state.
5. Owner Account after the live reading, showing 99 Credits and one saved reading.
6. Affiliate dashboard showing verified-conversion policy and no payout action.
7. Mobile Account at 390px.
8. Mobile Packages at 390px.

The screenshots contain no password, cookie, API key, payment data, raw share token, or private Tarot payload.

## Remaining external gates

1. Provision production SePay credentials and confirm the live payment/IPN/fulfillment contract before enabling real-money checkout.
2. Replace the invalid production Resend API key before claiming verification or password-reset email delivery.
3. Complete an interactive Google OAuth consent/login only if an owner wants that external-provider path exercised.

All internally implementable activation work in this scope is deployed. The product is safe to proceed to the final UI redesign while the three external gates remain visibly classified.
