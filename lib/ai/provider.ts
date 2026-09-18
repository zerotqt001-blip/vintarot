import { parseReadingPayload } from "../tarot-interpretation";
import { z } from "zod";
import type { TarotFollowUpInput, TarotFollowUpPayload, TarotProviderId, TarotReadingInput, TarotReadingPayload } from "./types";

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
  generateFollowUp?(input: TarotFollowUpInput): Promise<TarotFollowUpPayload>;
};

export const tarotFollowUpPayloadSchema = z.object({
  answer: z.string().min(1).max(3000),
}).strict();

export function parseTarotProviderContent(content: string, input: TarotReadingInput): TarotReadingPayload {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned invalid JSON.", { retryable: true });
  }

  try {
    return parseReadingPayload(value, input.cards, input.locale);
  } catch (error) {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned an invalid reading.", { retryable: true, cause: error });
  }
}

export function parseTarotFollowUpContent(content: string): TarotFollowUpPayload {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned invalid follow-up JSON.", { retryable: true, cause: error });
  }

  const parsed = tarotFollowUpPayloadSchema.safeParse(value);
  if (!parsed.success) {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned an invalid follow-up.", { retryable: true, cause: parsed.error });
  }
  return parsed.data;
}
