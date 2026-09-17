import { parseReadingPayload } from "../tarot-interpretation";
import type { TarotProviderId, TarotReadingInput, TarotReadingPayload } from "./types";

export type TarotAIErrorCode =
  | "configuration"
  | "timeout"
  | "upstream"
  | "invalid_response";

export class TarotAIError extends Error {
  readonly code: TarotAIErrorCode;
  readonly retryable: boolean;

  constructor(
    code: TarotAIErrorCode,
    message: string,
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotAIError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

export type TarotAIProvider = {
  id: TarotProviderId;
  model: string;
  generateReading(input: TarotReadingInput): Promise<TarotReadingPayload>;
};

export function parseTarotProviderContent(content: string, input: TarotReadingInput): TarotReadingPayload {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned invalid JSON.", { retryable: true });
  }

  try {
    return parseReadingPayload(value, input.cards, input.locale);
  } catch {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned an invalid reading.", { retryable: true });
  }
}
