# Fine-Tuning Readiness v5

Do not fine-tune solely because this corpus exists.

First:
- run provider A/B evaluation
- collect real anonymized failure categories where permitted
- improve prompts/retrieval
- ensure golden examples are consistently high quality
- separate style failures from knowledge/reasoning failures

Fine-tuning becomes useful when a stable recurring behavior cannot be corrected efficiently with system prompt, grounding, schema and few-shot selection.

If later producing training JSONL, create it from reviewed examples; do not blindly convert every generated fixture.
