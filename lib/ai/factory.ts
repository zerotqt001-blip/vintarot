import { createDeepSeekProvider } from "./deepseek";
import { createGeminiProvider } from "./gemini";
import type { TarotHTTPDependencies } from "./http";
import { createOpenAIProvider } from "./openai";
import { TarotAIError, type TarotAIProvider } from "./provider";
import type { TarotProviderId } from "./types";

export type TarotAIEnvironment = {
  TAROT_AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_TAROT_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_TAROT_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_TAROT_MODEL?: string;
};

const providerConfiguration = {
  openai: { key: "OPENAI_API_KEY", model: "OPENAI_TAROT_MODEL", create: createOpenAIProvider },
  gemini: { key: "GEMINI_API_KEY", model: "GEMINI_TAROT_MODEL", create: createGeminiProvider },
  deepseek: { key: "DEEPSEEK_API_KEY", model: "DEEPSEEK_TAROT_MODEL", create: createDeepSeekProvider },
} as const;

export function createTarotAIProvider(
  env: TarotAIEnvironment,
  dependencies: TarotHTTPDependencies = {},
): TarotAIProvider {
  const providerId = env.TAROT_AI_PROVIDER;
  if (!(providerId && providerId in providerConfiguration)) {
    throw new TarotAIError("configuration", "Tarot AI provider is not configured.");
  }

  const selected = providerConfiguration[providerId as TarotProviderId];
  const apiKey = env[selected.key];
  const model = env[selected.model];
  if (!(apiKey?.trim() && model?.trim())) {
    throw new TarotAIError("configuration", `Tarot AI ${providerId} configuration is incomplete.`);
  }

  return selected.create(apiKey, model, dependencies);
}
