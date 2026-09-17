import { buildTarotPromptContext, TAROT_RESPONSE_SCHEMA, TAROT_SYSTEM_PROMPT } from "./prompts/tarot-reading";
import { createTarotHTTPClient, type TarotHTTPDependencies } from "./http";
import { parseTarotProviderContent, TarotAIError, type TarotAIProvider } from "./provider";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function extractOutputText(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("output" in value) || !Array.isArray(value.output)) return null;
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
      ) return content.text;
    }
  }
  return null;
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

      const content = extractOutputText(envelope);
      if (content === null) throw new TarotAIError("invalid_response", "OpenAI returned an invalid response.", { retryable: true });
      return parseTarotProviderContent(content, input);
    },
  };
}
