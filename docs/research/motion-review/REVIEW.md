# Motion recheck — 2026-09-16
Reference: https://app.moonlight.world/ and existing test room /room/sxeudffJBa3FIcc2wmli.
Read-only live computed styles: homepage big-button layers 300ms ease-out; content 600ms ease-in; deck card-hover-container 500ms ease. Room guide 300ms cubic-bezier(.65,0,.35,1), guide contents 400ms same easing. Card transforms are not exposed as CSS transitions in sampled DOM; reveal timing remains visually tuned, not claimed exact.

Implementation: transform-only requestAnimationFrame dragging, state committed on release; pointer cancellation restores original position; scaled table bounds determine all coordinates; dragged card settles in place rather than replaying the deal from below. Fan adjacent cards lift, reveal uses 850ms lift/turn, guide uses measured timings; home ritual and feature hover timings aligned. Explicit device-width viewport. Reduced motion retained.

Validation: TypeScript passed. Browser DOM confirms device-width viewport and correctly sized mobile card bounds (94.6px = 220 * .43). Full visual parity and cross-device frame rate are not established.
Browser interaction: Draw card 40 then Reveal drawn card succeeded; two face-up cards present. Computed flip confirms 850ms easing. Visible rAF sample: 300 frames, average 8.31ms, p95 9.3ms, zero intervals >33ms; this measures scheduling, not guaranteed GPU rendering performance. Production build and final TypeScript check passed.

## Second pass: deck mixing and selection
Reference room re-inspected live. Nested DOM transforms expose outer rotateX(35deg), rotating Y axis, card orbit rotateX with counterrotation, and 150px card width. Replaced planar waterfall with 32 layered card orbit/counter-orbit animations. Clicking the deck starts/restarts mixing. Finish gathers the deck before showing fan. Pointer position drives a continuous Gaussian-like fan lift rather than one hovered card; click-to-deal captures the actual card rectangle as the animation origin. Fixed focus-induced scrolling of the fixed room via overflow:clip.
Browser verified deck click, mix again, finish and card selection: 77 cards remain in fan, one on table, nonzero origin offsets captured. Visual comparison completed for shuffling. Timing remains a reconstruction rather than extracted JS spring parameters.
