import { buildTarotPromptContext, TAROT_RESPONSE_SCHEMA, TAROT_SYSTEM_PROMPT } from "./prompts/tarot-reading";
import { createTarotHTTPClient, type TarotHTTPDependencies } from "./http";
import { parseTarotProviderContent, TarotAIError, type TarotAIProvider } from "./provider";

function extractCandidateText(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("candidates" in value) || !Array.isArray(value.candidates)) return null;
  const candidate = value.candidates[0];
  if (typeof candidate !== "object" || candidate === null || !("content" in candidate)) return null;
  const content = candidate.content;
  if (typeof content !== "object" || content === null || !("parts" in content) || !Array.isArray(content.parts)) return null;
  const part = content.parts[0];
  return typeof part === "object" && part !== null && "text" in part && typeof part.text === "string" ? part.text : null;
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
      const response = await request(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TAROT_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: buildTarotPromptContext(input) }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseSchema: TAROT_RESPONSE_SCHEMA,
          },
        }),
      });

      let envelope: unknown;
      try {
        envelope = await response.json();
      } catch {
        throw new TarotAIError("invalid_response", "Gemini returned an invalid response.", { retryable: true });
      }
      const content = extractCandidateText(envelope);
      if (content === null) throw new TarotAIError("invalid_response", "Gemini returned an invalid response.", { retryable: true });
      return parseTarotProviderContent(content, input);
    },
  };
}
