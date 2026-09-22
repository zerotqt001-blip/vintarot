import {
  buildTarotFollowUpPromptContext,
  buildTarotPromptContext,
  TAROT_FOLLOW_UP_RESPONSE_SCHEMA,
  TAROT_FOLLOW_UP_SYSTEM_PROMPT,
  TAROT_RESPONSE_SCHEMA,
  TAROT_SYSTEM_PROMPT,
} from "./prompts/tarot-reading";
import { createTarotHTTPClient, type TarotHTTPDependencies } from "./http";
import type { TarotProviderFailureStage } from "./diagnostics";
import { parseTarotFollowUpContent, parseTarotProviderContent, TarotAIError, type TarotAIProvider } from "./provider";

type ExtractedCandidateText = { content: string } | { failureStage: Extract<TarotProviderFailureStage, "provider_envelope_invalid" | "provider_content_missing"> };

function extractCandidateText(value: unknown): ExtractedCandidateText {
  if (typeof value !== "object" || value === null || !("candidates" in value) || !Array.isArray(value.candidates) || value.candidates.length === 0) {
    return { failureStage: "provider_envelope_invalid" };
  }
  const candidate = value.candidates[0];
  if (typeof candidate !== "object" || candidate === null || !("content" in candidate)) return { failureStage: "provider_envelope_invalid" };
  const content = candidate.content;
  if (typeof content !== "object" || content === null || !("parts" in content) || !Array.isArray(content.parts)) return { failureStage: "provider_envelope_invalid" };
  const part = content.parts[0];
  return typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
    ? { content: part.text }
    : { failureStage: "provider_content_missing" };
}

export function createGeminiProvider(
  apiKey: string,
  model: string,
  dependencies: TarotHTTPDependencies = {},
): TarotAIProvider {
  const request = createTarotHTTPClient(dependencies);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  return {
    id: "gemini",
    model,
    async generateReading(input) {
      const envelope = await request(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TAROT_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: buildTarotPromptContext(input) }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseJsonSchema: TAROT_RESPONSE_SCHEMA,
          },
        }),
      });

      const extracted = extractCandidateText(envelope);
      if ("failureStage" in extracted) {
        throw new TarotAIError("invalid_response", "Gemini returned an invalid response.", { retryable: true, failureStage: extracted.failureStage });
      }
      return parseTarotProviderContent(extracted.content, input);
    },
    async generateFollowUp(input) {
      const envelope = await request(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TAROT_FOLLOW_UP_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: buildTarotFollowUpPromptContext(input) }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseJsonSchema: TAROT_FOLLOW_UP_RESPONSE_SCHEMA,
          },
        }),
      });

      const extracted = extractCandidateText(envelope);
      if ("failureStage" in extracted) {
        throw new TarotAIError("invalid_response", "Gemini returned an invalid follow-up response.", { retryable: true, failureStage: extracted.failureStage });
      }
      return parseTarotFollowUpContent(extracted.content);
    },
  };
}
