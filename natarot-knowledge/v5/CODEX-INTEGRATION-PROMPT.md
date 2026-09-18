# IMPORTANT
NaTarot Knowledge Base V5 is the only authoritative package for this integration. V5 supersedes V1/V2/V3/V4. Do not import older versions alongside it.

# Codex Integration Prompt

Integrate `/natarot-knowledge-v5` as the provider-neutral grounding layer for NaTarot.

Requirements:
- Do not send all 78 cards to the model.
- Server reconstructs trusted context from card IDs and spread IDs.
- Retrieve only drawn cards plus relevant handbook sections.
- Use `prompts/system-prompt-v1.md` as the baseline system prompt, adapted to the application's structured output schema.
- Keep model provider abstract (OpenAI/Gemini/DeepSeek).
- Do not expose hidden chain-of-thought. Ask model for final structured interpretation only.
- Add prompt version metadata.
- Add evaluation fixtures from `evaluation/benchmark-readings.json`.
- Treat `examples/golden-readings.json` as quality references/few-shot candidates, not text to copy.
- Do not replace authoritative existing card IDs blindly; map knowledge records to the repo's canonical IDs.
- Preserve existing card draw logic.
- Validate model output server-side.
- Run typecheck, tests and build.

Before coding, audit existing DB/schema and report how this knowledge base maps to the current 78-card data. Prefer migration/extension over duplicate sources of truth.

V5: implement optional few-shot retrieval from `examples/human-style-50-complete.json` using `22-few-shot-selection.md`. Never inject the entire corpus. Keep authoritative card data separate from style examples.
