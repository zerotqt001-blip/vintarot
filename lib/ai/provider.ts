import { parseReadingPayload, TarotReadingValidationError } from "../tarot-interpretation";
import type { TarotAIDiagnosticDetails } from "./diagnostics";
import { z } from "zod";
import type { TarotClarificationInput, TarotClarificationPayload, TarotFollowUpInput, TarotFollowUpPayload, TarotProviderId, TarotReadingInput, TarotReadingPayload } from "./types";

export type TarotAIErrorCode =
  | "configuration"
  | "timeout"
  | "upstream"
  | "invalid_response";

export class TarotAIError extends Error {
  readonly code: TarotAIErrorCode;
  readonly retryable: boolean;
  readonly failureStage: TarotAIDiagnosticDetails["failureStage"];
  readonly httpStatus: TarotAIDiagnosticDetails["httpStatus"];
  readonly expectedCardCount: TarotAIDiagnosticDetails["expectedCardCount"];
  readonly actualCardEvidenceCount: TarotAIDiagnosticDetails["actualCardEvidenceCount"];
  readonly schemaIssuePath: TarotAIDiagnosticDetails["schemaIssuePath"];
  readonly schemaIssueCode: TarotAIDiagnosticDetails["schemaIssueCode"];

  constructor(
    code: TarotAIErrorCode,
    message: string,
    options?: { retryable?: boolean; cause?: unknown } & TarotAIDiagnosticDetails,
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotAIError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.failureStage = options?.failureStage;
    this.httpStatus = options?.httpStatus;
    this.expectedCardCount = options?.expectedCardCount;
    this.actualCardEvidenceCount = options?.actualCardEvidenceCount;
    this.schemaIssuePath = options?.schemaIssuePath;
    this.schemaIssueCode = options?.schemaIssueCode;
  }
}

export type TarotAIProvider = {
  id: TarotProviderId;
  model: string;
  generateReading(input: TarotReadingInput): Promise<TarotReadingPayload>;
  generateFollowUp?(input: TarotFollowUpInput): Promise<TarotFollowUpPayload>;
  generateClarification?(input: TarotClarificationInput): Promise<TarotClarificationPayload>;
};

export const tarotFollowUpPayloadSchema = z.object({
  answer: z.string().min(1).max(3000),
}).strict();

export const tarotClarificationPayloadSchema = tarotFollowUpPayloadSchema;

export function parseTarotProviderContent(content: string, input: TarotReadingInput): TarotReadingPayload {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned invalid JSON.", {
      retryable: true,
      failureStage: "provider_content_json_invalid",
    });
  }

  try {
    return parseReadingPayload(value, input.cards, input.locale);
  } catch (error) {
    const details = error instanceof TarotReadingValidationError ? error.details : { failureStage: "reading_schema_invalid" as const };
    throw new TarotAIError("invalid_response", "Tarot AI provider returned an invalid reading.", {
      retryable: true,
      cause: error,
      ...details,
    });
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

export function parseTarotClarificationContent(content: string): TarotClarificationPayload {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned invalid clarification JSON.", { retryable: true, cause: error });
  }

  const parsed = tarotClarificationPayloadSchema.safeParse(value);
  if (!parsed.success) {
    throw new TarotAIError("invalid_response", "Tarot AI provider returned an invalid clarification.", { retryable: true, cause: parsed.error });
  }
  return parsed.data;
}
