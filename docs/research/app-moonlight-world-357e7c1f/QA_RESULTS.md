# VinTarot QA — 2026-09-16

## Upstream integration
- Full upstream snapshot installed, pinned to 92872bc40ced2c5edb4d5dc9fd3970d40c77f4ca.
- Codex clone-website workflow available in the project.
- Upstream starter excluded from app type checking; existing routes preserved.
- TypeScript check passed; Sites production build passed after integration.

## Verified through the local browser
- Restored previously saved room.
- Dragged a card directly from the fan to the table.
- Revealed Queen of Pentacles; guide updated correctly.
- Room saved automatically and save-to-journal returned success.
- Earlier tests: guidebook search, upright/reversed toggle, deck navigation and WebMCP valid/invalid lookup.

## Motion sample
- Visible local browser, current machine, 300 requestAnimationFrame intervals while testing reveal.
- Mean 8.43 ms; 95th percentile 9.3 ms; 0 intervals over 33.4 ms.
- This is a browser scheduling sample, not a GPU frame trace or a benchmark against Moonlight. It does not prove pixel-perfect motion parity.

## Remaining work
- Full original/clone comparison at 1440, 768 and 390 pixels; mobile room layout needs further verification.
- Measure original easing and timing; current recreation uses approximate custom transforms.
- Validate all room tools, conflict handling, cross-user sharing and journal reload/edit flows.
- Video, payment, email, reader onboarding and public operation need service setup.

## Publishing blocker
Sites get_site and update_site_metadata returned project_not_found for the project ID previously returned by create_site. The existing ID is preserved. No replacement Site was created and no deployment succeeded. Resolve the Sites account/project visibility before publication.
