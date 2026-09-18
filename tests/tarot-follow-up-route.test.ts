import assert from "node:assert/strict";
import test from "node:test";
import { TarotAIError } from "../lib/ai/provider";
import { handleTarotFollowUpRoute } from "../lib/tarot-follow-up-route";
import { TarotFollowUpServiceError } from "../lib/tarot-follow-up-service";

const result = {
  sessionId: "session-1",
  locale: "en" as const,
  source: "ai" as const,
  provider: "openai" as const,
  modelName: "openai:follow-up-model",
  promptVersion: "tarot-follow-up-v1" as const,
  answer: "Start with the smallest observable step.",
};

async function json(response: Response) {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

test("accepts only the bounded follow-up request shape and returns an allowlisted response", async () => {
  let executed = false;
  const response = await handleTarotFollowUpRoute({
    loadBody: async () => ({ session_id: "session-1", locale: "en", follow_up_question: "What should I notice first?" }),
    execute: async (input) => {
      executed = true;
      assert.equal(input.follow_up_question, "What should I notice first?");
      return { result, setCookie: "vintarot_guest=guest-1; HttpOnly" };
    },
    log: () => undefined,
  });

  assert.equal(executed, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), "vintarot_guest=guest-1; HttpOnly");
  assert.deepEqual(await json(response), {
    session_id: "session-1",
    locale: "en",
    source: "ai",
    provider: "openai",
    model_name: "openai:follow-up-model",
    prompt_version: "tarot-follow-up-v1",
    answer: result.answer,
  });
});

test("rejects unknown fields, invalid locales, empty questions, and questions over 1000 characters", async () => {
  for (const body of [
    { session_id: "session-1", locale: "en", follow_up_question: "question", transcript: "private" },
    { session_id: "session-1", locale: "fr", follow_up_question: "question" },
    { session_id: "session-1", locale: "en", follow_up_question: "" },
    { session_id: "session-1", locale: "en", follow_up_question: "x".repeat(1001) },
  ]) {
    let executed = false;
    const response = await handleTarotFollowUpRoute({
      loadBody: async () => body,
      execute: async () => { executed = true; return { result }; },
      log: () => undefined,
    });
    assert.equal(response.status, 400);
    assert.equal(executed, false);
    assert.deepEqual(await json(response), { error: "Invalid Tarot follow-up request." });
  }
});

test("maps service and provider failures without logging question content", async () => {
  const secret = "PRIVATE_FOLLOW_UP_QUESTION";
  for (const [error, expectedStatus, expectedMessage] of [
    [new TarotFollowUpServiceError("not_found", "private"), 404, "Reading session not found."],
    [new TarotFollowUpServiceError("incomplete", "private"), 409, "This reading is not ready for a follow-up."],
    [new TarotAIError("invalid_response", secret, { retryable: true }), 503, "Tarot follow-up is temporarily unavailable. Please try again."],
  ] as const) {
    const events: unknown[] = [];
    const response = await handleTarotFollowUpRoute({
      loadBody: async () => ({ session_id: "session-1", locale: "vi", follow_up_question: secret }),
      execute: async () => { throw error; },
      log: (event) => events.push(event),
    });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await json(response), { error: expectedMessage });
    assert.equal(JSON.stringify(events).includes(secret), false);
  }
});
