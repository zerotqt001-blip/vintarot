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

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type ExtractedOutputText = { content: string } | { failureStage: Extract<TarotProviderFailureStage, "provider_envelope_invalid" | "provider_content_missing"> };

function extractOutputText(value: unknown): ExtractedOutputText {
  if (typeof value !== "object" || value === null || !("output" in value) || !Array.isArray(value.output) || value.output.length === 0) {
    return { failureStage: "provider_envelope_invalid" };
  }
  for (const output of value.output) {
    if (typeof output !== "object" || output === null || !("content" in output) || !Array.isArray(output.content)) continue;
    for (const content of output.content) {
      if (
        typeof content === "object"
        && content !== null
        && "type" in content
        && content.type === "output_text"
        && "text" in content
        && typeof content.text === "string"
      ) return { content: content.text };
    }
  }
  return { failureStage: "provider_content_missing" };
}

export function createOpenAIProvider(
  apiKey: string,
  model: string,
  dependencies: TarotHTTPDependencies = {},
): TarotAIProvider {
  const request = createTarotHTTPClient(dependencies);

  return {
    id: "openai",
    model,
    async generateReading(input) {
      const envelope = await request(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          instructions: TAROT_SYSTEM_PROMPT,
          input: buildTarotPromptContext(input),
          store: false,
          temperature: 0.35,
          max_output_tokens: 5000,
          text: {
            format: {
              type: "json_schema",
              name: "tarot_reading",
              strict: true,
              schema: TAROT_RESPONSE_SCHEMA,
            },
          },
        }),
      });

      const extracted = extractOutputText(envelope);
      if ("failureStage" in extracted) {
        throw new TarotAIError("invalid_response", "OpenAI returned an invalid response.", { retryable: true, failureStage: extracted.failureStage });
      }
      return parseTarotProviderContent(extracted.content, input);
    },
    async generateFollowUp(input) {
      const envelope = await request(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          instructions: TAROT_FOLLOW_UP_SYSTEM_PROMPT,
          input: buildTarotFollowUpPromptContext(input),
          store: false,
          temperature: 0.35,
          max_output_tokens: 2200,
          text: {
            format: {
              type: "json_schema",
              name: "tarot_follow_up",
              strict: true,
              schema: TAROT_FOLLOW_UP_RESPONSE_SCHEMA,
            },
          },
        }),
      });

      const extracted = extractOutputText(envelope);
      if ("failureStage" in extracted) {
        throw new TarotAIError("invalid_response", "OpenAI returned an invalid follow-up response.", { retryable: true, failureStage: extracted.failureStage });
      }
      return parseTarotFollowUpContent(extracted.content);
    },
  };
}
