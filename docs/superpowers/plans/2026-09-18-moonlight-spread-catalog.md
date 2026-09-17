# Moonlight spread catalog and layout parity

## Goal

Bring the Room spread picker in line with the inspected Moonlight reference: expose all nine topic groups, all 57 non-Blank child spreads, and preserve each spread's observed card arrangement so the customer's random selections land in the correct semantic positions.

## Scope

- Add the Blank, Everyday, Self-care, Relationships, Planning, Moon Phase, Creativity, Business, and Fool's Journey categories.
- Add every inspected child spread and its ordered position labels, bilingual copy, card count, and layout key.
- Keep the full 78-card customer-facing fan and existing random/unique draw behavior.
- Resolve row-2, row-3, row-4, row-5, single, triangle, top-1-bottom-3, yes/no, cross-4, and Celtic Cross layouts from semantic position keys.
- Render slots and drawn cards from the same resolver so labels, server position orders, cards, and previews stay aligned.
- Seed the catalog idempotently for both a fresh database and an existing deployment.

## Layout rules captured from Moonlight

- Standard row spreads use left-to-right semantic order except where the reference explicitly reverses DOM order; the catalog keeps semantic order and the resolver uses position keys.
- Compact four- and five-card spreads reduce card scale while keeping even spacing across the table.
- Give/Receive/Create and Creativity/Work/Relationships use a centered upper card with a lower grouping.
- Yes or No uses two upper choices and two lower consequence branches.
- Conflict/Bridge/Path uses a top bridge, two middle energies, and a bottom path.
- Celtic Cross uses a crossed center, vertical surrounding cards, and a four-card outcome column.

## Verification

- Unit tests assert the full category/template/position catalog and representative layout families.
- Source tests assert the Room exposes all categories and consumes the semantic layout resolver for both slots and drawn cards.
- Run the focused suite, TypeScript, production build, archive validation, and a browser check of the picker plus representative layouts.
