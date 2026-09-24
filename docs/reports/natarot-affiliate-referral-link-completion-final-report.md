# NaTarot Affiliate Referral Link Completion

Ngày triển khai: 2026-09-24 (Asia/Ho_Chi_Minh)

## Kết quả cuối

REFERRAL CODE: **PASS**

REFERRAL LINK: **PASS**

QR: **PASS**

ATTRIBUTION: **PARTIAL** — cơ chế hiện hành được giữ nguyên và không thêm anonymous cookie hoặc attribution rule mới; attribution hiện chỉ chạy cho member đã đăng nhập, nên mở link trước đăng nhập cần một quyết định policy riêng để replay sau auth.

COMMISSION SAFETY: **PASS**

PRODUCTION DEPLOY: **PASS**

PRODUCTION POLICY: **INACTIVE** — policy `affiliate-v1-default` vẫn `DRAFT`, không tự kích hoạt.

CUSTOMER FEATURE AVAILABLE: **NO** — bị policy gate đúng thiết kế; production không tạo link giả cho tài khoản khi policy chưa ACTIVE.

REMAINING ISSUES: Cần quyết định kinh doanh và thao tác activation riêng để chuyển policy sang `ACTIVE`; attribution trước đăng nhập chưa được mở rộng theo đúng phê duyệt không thêm anonymous cookie; PR integration với UI V2 còn conflict cần xử lý riêng. Sau khi policy ACTIVE, cần một phiên QA có tài khoản member đủ điều kiện đã xác thực để kiểm tra live code/link/QR và đăng nhập lại; không tự thực hiện activation.

## Đã triển khai

- Migration `0009_affiliate_referral_links.sql` thêm `referral_codes.public_code` nullable, unique khi có giá trị, cùng unique constraint cho một dashboard code ACTIVE/profile.
- Code `NTR-` opaque, random bằng Web Crypto, không chứa thông tin cá nhân, tạo một lần và giữ ổn định nhờ canonical row/profile unique key.
- Customer dashboard API trả owner-scoped `referralLink` gồm code, canonical `https://natarot.com/affiliate?ref=...`, QR SVG data URL và filename tải xuống.
- Affiliate panel hiện có code, link, copy code/link, share, QR và download QR; trạng thái unavailable policy/profile/eligibility được hiển thị và không có action/link/QR giả.
- `scripts/node-migrate.mjs` bọc migration mới cùng migration marker trong transaction; historical seed migration đang tự quản lý `BEGIN/COMMIT` được giữ nguyên.
- Attribution capture, cookie behavior, eligibility và active-policy gating được giữ nguyên. Commission ledger và verified fulfillment vẫn là ranh giới authoritative; mutation idempotency được scope theo conversion, đồng thời nhận diện legacy ledger/audit key để không tạo duplicate history hoặc mất audit event.

## Migration/data safety

- Dry-run trên bản sao backup `natarot-production-20260924-112017` đạt `preserved=true`, `integrity=ok`, `foreignKeyViolations=0`; các digest referral hash, attribution, conversion, ledger và policy không đổi.
- Production sau deploy ghi nhận `0009_affiliate_referral_links.sql`, có cột `public_code`; `public_code` rows `0`, referral codes `0`, attributions `0`, conversions `0`, ledger `0`.
- Production profile hiện có `ACTIVE=2`; policy vẫn `DRAFT`. Không backfill và không thay đổi lịch sử.
- Legacy fixture tests xác nhận hash, attribution, fulfilled conversion và commission ledger giữ nguyên byte-level projection sau migration.

## Verification

- Full regression: `624/624` pass.
- Focused Affiliate/migration/UI suite: `9/9` pass; Affiliate service idempotency regression: `5/5` pass sau red-green fix loop.
- Admin Affiliate route audit-key contract: `3/3` pass.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- Targeted ESLint: `0 errors`, một warning hiện hữu cho QR `<img>` data URL (`@next/next/no-img-element`).
- `npm audit --omit=dev --audit-level=high`: `0 vulnerabilities`.
- `git diff --check` và staged secret-pattern scan: pass.
- Verified tests cover unique/stable code, owner isolation, QR exact payload, inactive policy/profile, no self-referral, existing attribution behavior, fulfilled-only commission, conversion-scoped ledger idempotency, legacy ledger/audit compatibility and conversion-scoped audit keys.

## Production evidence

- Current release: `affiliate-referral-3405b75-20260924T113918Z`.
- Rollback releases retained: `affiliate-referral-0b1a605-20260924T111942Z` and `affiliate-dashboard-c3cd0ff-20260924T103004Z`.
- Fresh backup: `natarot-production-20260924-113938`; archive SHA-256 `0b0e2da834d03e09021de7f273b8d71ec535530772a8f22060ef94e2de61854d`; backup status `success`. Release manager backup/restore verification passed.
- `natarot.service`: `active`; `https://natarot.com/api/health`: `{"status":"ok"}`.
- `https://natarot.com/api/affiliate/policy`: `{"policy":null}`.
- Guest `GET /api/affiliate/dashboard`: `401` with no-store boundary.
- `https://natarot.com/affiliate?ref=NTR-PROBE-ONLY`: `200`; response emitted no `affiliate`/`ref` cookie.
- Browser QA on production shows the Referral Link panel with “Chính sách Affiliate chưa hoạt động nên chưa tạo liên kết giới thiệu”, without code/link/QR actions. The public Affiliate policy message remains visible.
- Cleanup retained exactly three releases and removed one unprotected old release.

## Commits

- `0b0b656` — stable referral-link backend/API implementation.
- `0b1a605` — Affiliate referral-link panel and tests.
- `3405b75` — migration transaction hardening, inactive-policy panel rendering and accurate public-code security copy.
