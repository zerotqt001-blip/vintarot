# Combination Engine Spec v4

Input: ordered cards with position semantics.

1. Build card propositions.
2. Score pair relevance:
   - adjacent/linked positions
   - shared/contrasting suit/domain
   - repeated rank/archetype
   - Major thematic relationship
   - curated pair match
3. Keep strongest 1-3 edges only.
4. Detect triad/global pattern.
5. Give model compact edge hints, not fixed conclusions.
6. Model may reject a heuristic when position/question makes it irrelevant.

This engine is a reasoning aid, not a deterministic Tarot rules engine.
