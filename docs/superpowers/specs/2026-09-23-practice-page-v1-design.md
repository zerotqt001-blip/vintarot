# NaTarot Practice Page V1 Design

## Intent

Replace the current `/community` (Luyện tập) visual composition with the owner-approved Image 1 direction while preserving the existing Practice behavior and the shared NaTarot brand system. Image 2 is an anti-reference for the current layout only; it is not a design target.

## Product truth and boundaries

- The existing `Practice` component in `app/pages.tsx` remains authoritative for card selection, card artwork, locale-aware meaning copy, reflection text, journal saving, reveal/hide behavior, card replacement and the `/room` CTA.
- No Tarot API, database schema, persistence contract, card catalog, interpretation engine, authentication boundary or unrelated route changes are allowed.
- The shared shell in `app/vintarot.tsx` remains the only Header/Sidebar/Footer implementation. Practice gets a conditional variant of that shell; no parallel shell component is introduced.
- Only the Practice visual shell, Practice markup, Practice-local translations, Practice-local CSS, focused Practice tests and project-state documentation are in scope.

## Visual direction

- Full-bleed midnight observatory background using the existing local celestial artwork and the established navy/champagne/ivory tokens.
- Desktop first viewport: header, full labeled five-entry left rail, centered hero, two-column card/reflection experience, slim right editorial guidance rail and footer.
- Header: NaTarot logo and tagline; four active navigation links (`Trang chủ`, `Lá bài`, `Luyện tập`, `Đặt phiên đọc`); search, favorite, locale, theme and account controls. The Practice variant does not show `+ Phòng`, the old duplicate commercial buttons or the five-link daily-spread navigation.
- Left rail: exactly `Trang chủ`, `Rút Bài Ngay`, `Gói Thành Viên`, `Affiliate`, `Tài Khoản`, with the existing Lucide icon system and links to the existing routes.
- Hero: moon phases, localized `LUYỆN TẬP · TRỰC GIÁC` eyebrow, `Một chút luyện tập.` title, target subtitle and divider.
- Practice area: real randomized card with artwork, orbit geometry, card metadata and replacement action beside a reflection panel with step label, prompt, 500-character textarea/count, save action and interpretation action.
- Guidance rail: localized editorial quote, `Quan sát → Suy ngẫm → Khám phá` sequence and closing mirror quote. It is hidden or reflowed at narrow widths without creating a blank right column.
- Existing read-together card remains below the first viewport so its `/room` behavior is retained without competing with the target composition.

## Responsive behavior

- Desktop (`>1100px`): full rail labels, two-column card/reflection grid and right guidance rail.
- Tablet (`701–1100px`): compact shared shell, reduced content width, two-column Practice area where space permits, guidance reflowed below the main composition.
- Mobile (`<=700px`): compact icon rail, top navigation hidden, one-column hero/card/reflection flow, touch-sized controls, safe-area-aware footer and no horizontal overflow. Practice text remains localized and all actions remain reachable.
- `prefers-reduced-motion` disables decorative orbit/entry effects while retaining visible content and state transitions.

## Data and interaction flow

1. `Practice` selects the first card from `shuffleDeck()` on mount.
2. `Lá khác` runs the existing transition, selects another real card, clears the reflection/reveal state and keeps the current locale.
3. Textarea input remains capped at 500 characters and updates the visible count.
4. `Lưu suy ngẫm` stays disabled for empty input and writes the existing `records` journal payload; success and error messages remain in the existing status region.
5. `Xem diễn giải` toggles the existing locale-aware `cardMeaning` content.
6. The read-together CTA remains a normal link to `/room`.

## Verification contract

- Focused source-contract tests assert the Practice variant shell labels/routes, the target hero/guidance markers, existing behavior markers and scoped CSS hooks.
- Run the focused tests through a red-green cycle before implementation is considered valid.
- Run the tracked test suite, TypeScript, production build and `git diff --check`.
- Capture local Practice screenshots at desktop and mobile target widths, inspect the captures, and make one batched visual correction pass at most.
- Inspect the public `/community` route and current production asset response before deployment; the VPS deployment is allowed only if SSH access and the verified release procedure are available. If remote authentication is unavailable, report deployment as blocked rather than claiming success.
