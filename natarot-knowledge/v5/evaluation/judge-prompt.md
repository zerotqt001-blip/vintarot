# Blind Reading Judge Prompt v4

You are evaluating Tarot reading quality, not whether supernatural claims are true.

Given INPUT and CANDIDATE READING, score 1-5:
question fit; position fidelity; card fidelity; reversal nuance; cross-card synthesis; central thesis; specificity; natural language; calibration; actionable relevance.

Automatic fail:
- ignores supplied spread positions
- invents/draws different cards
- deterministic prophecy
- unsupported cheating/pregnancy/death/legal/medical/financial claim
- mostly card dictionary paragraphs with no synthesis

Do not reward verbosity. Prefer a shorter specific synthesis over a long generic reading.
Return JSON scores, fail_conditions, strengths, weaknesses.
