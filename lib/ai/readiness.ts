import type { TarotAIEnvironment } from "./factory";
import { TarotAIError } from "./provider";

export const TAROT_AI_FAILURE_CATEGORIES = [
  "TAROT_AI_PROVIDER_UNAVAILABLE",
  "TAROT_AI_PROVIDER_AUTH_FAILED",
  "TAROT_AI_PROVIDER_TIMEOUT",
  "TAROT_AI_RESPONSE_INVALID",
  "TAROT_AI_PERSISTENCE_FAILED",
  "TAROT_AI_CREDITS_INSUFFICIENT",
  "TAROT_AI_CREDITS_CONFLICT",
  "TAROT_AI_CREDITS_UNAVAILABLE",
  "TAROT_AI_SESSION_NOT_FOUND",
  "TAROT_AI_SESSION_INCOMPLETE",
  "TAROT_AI_REQUEST_REJECTED",
  "TAROT_AI_UNEXPECTED",
] as const;

export type TarotAIFailureCategory = typeof TAROT_AI_FAILURE_CATEGORIES[number];

const providerConfiguration = {
  openai: ["OPENAI_API_KEY", "OPENAI_TAROT_MODEL"],
  gemini: ["GEMINI_API_KEY", "GEMINI_TAROT_MODEL"],
  deepseek: ["DEEPSEEK_API_KEY", "DEEPSEEK_TAROT_MODEL"],
} as const;

export type TarotAIConfigurationStatus = {
  status: "CONFIGURED" | "UNCONFIGURED";
  provider?: string;
  model?: string;
};

export function readTarotAIConfiguration(env: TarotAIEnvironment): TarotAIConfigurationStatus {
  const provider = env.TAROT_AI_PROVIDER?.trim().toLowerCase() as keyof typeof providerConfiguration | undefined;
  if (!provider || !providerConfiguration[provider]) return { status: "UNCONFIGURED" };
  const [keyName, modelName] = providerConfiguration[provider];
  const key = env[keyName as keyof TarotAIEnvironment];
  const model = env[modelName as keyof TarotAIEnvironment];
  if (typeof key !== "string" || !key.trim() || typeof model !== "string" || !model.trim()) {
    return { status: "UNCONFIGURED" };
  }
  return { status: "CONFIGURED", provider, model: model.trim() };
}

export function classifyTarotAIError(error: TarotAIError): TarotAIFailureCategory {
  if (error.code === "timeout") return "TAROT_AI_PROVIDER_TIMEOUT";
  if (error.code === "invalid_response") return "TAROT_AI_RESPONSE_INVALID";
  if (error.code === "upstream" && (error.httpStatus === 401 || error.httpStatus === 403)) {
    return "TAROT_AI_PROVIDER_AUTH_FAILED";
  }
  return "TAROT_AI_PROVIDER_UNAVAILABLE";
}

export function classifyTarotServiceFailure(code: string): TarotAIFailureCategory {
  if (code === "persistence") return "TAROT_AI_PERSISTENCE_FAILED";
  if (code === "not_found") return "TAROT_AI_SESSION_NOT_FOUND";
  if (code === "incomplete") return "TAROT_AI_SESSION_INCOMPLETE";
  return "TAROT_AI_PROVIDER_UNAVAILABLE";
}

export function classifyTarotCreditFailure(code: string): TarotAIFailureCategory {
  if (code === "unauthenticated") return "TAROT_AI_REQUEST_REJECTED";
  if (code === "reading_required") return "TAROT_AI_CREDITS_INSUFFICIENT";
  if (code === "insufficient") return "TAROT_AI_CREDITS_INSUFFICIENT";
  if (code === "conflict" || code === "in_progress") return "TAROT_AI_CREDITS_CONFLICT";
  return "TAROT_AI_CREDITS_UNAVAILABLE";
}
