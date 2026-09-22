import assert from "node:assert/strict";
import test from "node:test";
import { TarotAIError } from "../lib/ai/provider";
import {
  classifyTarotAIError,
  classifyTarotServiceFailure,
  readTarotAIConfiguration,
} from "../lib/ai/readiness";

test("reports configured provider status without returning a secret", () => {
  const result = readTarotAIConfiguration({
    TAROT_AI_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "PRIVATE_KEY_VALUE",
    DEEPSEEK_TAROT_MODEL: "deepseek-flash",
  });
  assert.deepEqual(result, { status: "CONFIGURED", provider: "deepseek", model: "deepseek-flash" });
  assert.equal(JSON.stringify(result).includes("PRIVATE_KEY_VALUE"), false);
});

test("reports missing provider configuration safely", () => {
  assert.deepEqual(readTarotAIConfiguration({ TAROT_AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "" }), { status: "UNCONFIGURED" });
  assert.deepEqual(readTarotAIConfiguration({ TAROT_AI_PROVIDER: "unknown", DEEPSEEK_API_KEY: "secret", DEEPSEEK_TAROT_MODEL: "model" }), { status: "UNCONFIGURED" });
});

test("maps provider failures into operational categories", () => {
  assert.equal(classifyTarotAIError(new TarotAIError("configuration", "private")), "TAROT_AI_PROVIDER_UNAVAILABLE");
  assert.equal(classifyTarotAIError(new TarotAIError("upstream", "private", { httpStatus: 401 })), "TAROT_AI_PROVIDER_AUTH_FAILED");
  assert.equal(classifyTarotAIError(new TarotAIError("upstream", "private", { httpStatus: 429 })), "TAROT_AI_PROVIDER_UNAVAILABLE");
  assert.equal(classifyTarotAIError(new TarotAIError("timeout", "private")), "TAROT_AI_PROVIDER_TIMEOUT");
  assert.equal(classifyTarotAIError(new TarotAIError("invalid_response", "private")), "TAROT_AI_RESPONSE_INVALID");
});

test("maps persistence and session failures separately from provider failure", () => {
  assert.equal(classifyTarotServiceFailure("persistence"), "TAROT_AI_PERSISTENCE_FAILED");
  assert.equal(classifyTarotServiceFailure("incomplete"), "TAROT_AI_SESSION_INCOMPLETE");
});
