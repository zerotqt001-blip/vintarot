# Room motion observations

Observed directly in Moonlight during this task:
- Ready: layered white deck at center; guide on left; tools on right.
- Shuffle: individual layers flow vertically with staggered timing, slight alternating rotation and depth.
- Finish shuffle: spread slots appear and a curved overlapping fan occupies the bottom.
- Drag: a card can be pulled directly from the fan onto the table.
- Reveal: card lifts and tilts, flips, then settles; shadow grows during lift.
- Guide updates to card meaning after reveal.

Reference exact duration/easing is not yet extracted. Current VinTarot durations are approximations, not measured parity.
Pending: same-size desktop/tablet/mobile captures; frame measurements; drag drop-coordinate regression; concurrent room update testing.

# Spread catalog and arrangement observations

The Moonlight spread picker was inspected category by category. It exposes nine groups: Blank, Everyday, Self-care, Relationships, Planning, Moon Phase, Creativity, Business, and Fool's Journey. Blank is a clear-table action; the other groups contain 57 child spreads in total.

The child spread names and ordered role labels were copied into the canonical VinTarot catalog. The observed arrangements were classified by geometry rather than treated as one generic row:

| Layout family | Moonlight child spreads observed |
| --- | --- |
| Single centered | My Energy Today |
| Two-card row | How To Handle It; What To Look Forward To; Progress Check; Last Night, This Morning; Born To, Forced To; Love, Deserve; Big Feelings; Act or Wait; Conflict & Resolution; Stay or Go; Already Learned, Need to Learn; Safe Choice, Wild Choice |
| Three-card row | Persona, Obstacle, Solution; Today’s Forecast; Energy Refresh; Yesterday, Today, Tomorrow; Setting Intentions; Mind, Body, Spirit; Strength, Weakness, Magic; Relationship Check-In; New Connection; Dating Vibe; Better Communication; Unclear Feelings; Your Path Together; What That Text Really Meant; Goals & Aspirations; Past, Present, Future; Career Crossroads; all eight Moon Phase spreads; all four Creativity spreads; The Big Meeting; Divine Mischief |
| Compact four-card row | Attracting Love; Finding Your People; Finding Home; Finding Your Magic; Strategic Overview (SWOT); Between Worlds |
| Compact five-card row | Product Market Fit |
| Triangle | Give, Receive, Create |
| Top card plus bottom three | Creativity, Work, Relationships |
| Two choices plus two consequence branches | Yes or No |
| Top bridge, two middle energies, bottom path | Conflict, Bridge, Path |
| Celtic Cross | Celtic Cross: crossed center, surrounding timeline, and four-card outcome column |

The reference has a few intentional visual-order details: How To Handle It places the best option left and worst option right; Mind, Body, Spirit places Mind left, Body center, Spirit right despite the observed DOM sequence; Yes or No places the Yes consequence lower-left and No consequence lower-right. VinTarot resolves these placements from stable position keys, and both empty slots and selected face-up cards consume the same coordinates.
