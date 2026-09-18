import {
  buildTarotFollowUpPromptContext,
  buildTarotPromptContext,
  TAROT_FOLLOW_UP_JSON_OUTPUT_CONTRACT,
  TAROT_FOLLOW_UP_SYSTEM_PROMPT,
  TAROT_JSON_OUTPUT_CONTRACT,
  TAROT_SYSTEM_PROMPT,
} from "./prompts/tarot-reading";
import { createTarotHTTPClient, type TarotHTTPDependencies } from "./http";
import { parseTarotFollowUpContent, parseTarotProviderContent, TarotAIError, type TarotAIProvider } from "./provider";

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";

function extractMessageContent(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("choices" in value) || !Array.isArray(value.choices)) return null;
  const choice = value.choices[0];
  if (typeof choice !== "object" || choice === null || !("message" in choice)) return null;
  const message = choice.message;
  return typeof message === "object" && message !== null && "content" in message && typeof message.content === "string"
    ? message.content
    : null;
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

      const content = extractMessageContent(envelope);
      if (content === null) throw new TarotAIError("invalid_response", "DeepSeek returned an invalid response.", { retryable: true });
      return parseTarotProviderContent(content, input);
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

      const content = extractMessageContent(envelope);
      if (content === null) throw new TarotAIError("invalid_response", "DeepSeek returned an invalid follow-up response.", { retryable: true });
      return parseTarotFollowUpContent(content);
    },
  };
}
