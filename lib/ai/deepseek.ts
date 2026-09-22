import {
  buildTarotFollowUpPromptContext,
  buildTarotPromptContext,
  TAROT_FOLLOW_UP_JSON_OUTPUT_CONTRACT,
  TAROT_FOLLOW_UP_SYSTEM_PROMPT,
  TAROT_JSON_OUTPUT_CONTRACT,
  TAROT_SYSTEM_PROMPT,
} from "./prompts/tarot-reading";
import { createTarotHTTPClient, type TarotHTTPDependencies } from "./http";
import type { TarotProviderFailureStage } from "./diagnostics";
import { parseTarotFollowUpContent, parseTarotProviderContent, TarotAIError, type TarotAIProvider } from "./provider";

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";

type ExtractedMessageContent = { content: string } | { failureStage: Extract<TarotProviderFailureStage, "provider_envelope_invalid" | "provider_content_missing"> };

function extractMessageContent(value: unknown): ExtractedMessageContent {
  if (typeof value !== "object" || value === null || !("choices" in value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    return { failureStage: "provider_envelope_invalid" };
  }
  const choice = value.choices[0];
  if (typeof choice !== "object" || choice === null || !("message" in choice)) return { failureStage: "provider_envelope_invalid" };
  const message = choice.message;
  if (typeof message !== "object" || message === null || !("content" in message) || typeof message.content !== "string") {
    return { failureStage: "provider_content_missing" };
  }
  return { content: message.content };
}

export function createDeepSeekProvider(
  apiKey: string,
  model: string,
  dependencies: TarotHTTPDependencies = {},
): TarotAIProvider {
  const request = createTarotHTTPClient({
    ...dependencies,
    timeoutMs: dependencies.timeoutMs ?? 20_000,
  });

  return {
    id: "deepseek",
    model,
    async generateReading(input) {
      const envelope = await request(DEEPSEEK_CHAT_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: TAROT_SYSTEM_PROMPT },
            { role: "user", content: `${TAROT_JSON_OUTPUT_CONTRACT}\n\n${buildTarotPromptContext(input)}` },
          ],
        }),
      });

      const extracted = extractMessageContent(envelope);
      if ("failureStage" in extracted) {
        throw new TarotAIError("invalid_response", "DeepSeek returned an invalid response.", {
          retryable: true,
          failureStage: extracted.failureStage,
        });
      }
      return parseTarotProviderContent(extracted.content, input);
    },
    async generateFollowUp(input) {
      const envelope = await request(DEEPSEEK_CHAT_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: TAROT_FOLLOW_UP_SYSTEM_PROMPT },
            { role: "user", content: `${TAROT_FOLLOW_UP_JSON_OUTPUT_CONTRACT}\n\n${buildTarotFollowUpPromptContext(input)}` },
          ],
        }),
      });

      const extracted = extractMessageContent(envelope);
      if ("failureStage" in extracted) {
        throw new TarotAIError("invalid_response", "DeepSeek returned an invalid follow-up response.", {
          retryable: true,
          failureStage: extracted.failureStage,
        });
      }
      return parseTarotFollowUpContent(extracted.content);
    },
  };
}
