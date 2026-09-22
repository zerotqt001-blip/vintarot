import assert from "node:assert/strict";
import test from "node:test";
import { TAROT_CLARIFICATION_PROMPT_VERSION } from "../lib/ai/prompts/tarot-reading";
import { TarotAIError } from "../lib/ai/provider";
import { handleTarotClarificationRoute } from "../lib/tarot-clarification-route";
import { TarotClarificationServiceError, type GeneratedTarotClarification } from "../lib/tarot-clarification-service";

const result: GeneratedTarotClarification = {
  sessionId: "session-1",
  readingId: "reading-1",
  locale: "en" as const,
  source: "ai" as const,
  provider: "deepseek" as const,
  modelName: "deepseek:clarification-model",
  promptVersion: TAROT_CLARIFICATION_PROMPT_VERSION,
  clarification: {
    id: "clarification-1",
    requestId: "request-1",
    sequence: 1,
    question: "What should I notice?",
    relationship: "clarification" as const,
    card: { id: "card-sun", nameEn: "The Sun", nameVi: "The Sun", arcana: "major", suit: "Major Arcana" },
    orientation: "upright" as const,
    answer: "Notice the smallest observable choice.",
  },
};

async function json(response: Response) {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

test("accepts the bounded clarification request and returns the allowlisted result", async () => {
  let executed = false;
  const response = await handleTarotClarificationRoute({
    loadBody: async () => ({ session_id: "session-1", locale: "en", question: "What should I notice?", request_id: "request-1" }),
    execute: async (input) => {
      executed = true;
      assert.equal(input.question, "What should I notice?");
      assert.equal(input.request_id, "request-1");
      return { result, setCookie: "vintarot_guest=guest-1; HttpOnly" };
    },
    log: () => undefined,
  });

  assert.equal(executed, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), "vintarot_guest=guest-1; HttpOnly");
  assert.deepEqual(await json(response), {
    session_id: result.sessionId,
    reading_id: result.readingId,
    locale: result.locale,
    source: result.source,
    provider: result.provider,
    model_name: result.modelName,
    prompt_version: result.promptVersion,
    clarification: result.clarification,
  });
});

test("rejects unknown fields, invalid locales, empty input, and oversized request ids", async () => {
  for (const body of [
    { session_id: "session-1", locale: "en", question: "question", request_id: "request-1", card_id: "client-card" },
    { session_id: "session-1", locale: "fr", question: "question", request_id: "request-1" },
    { session_id: "session-1", locale: "en", question: "", request_id: "request-1" },
    { session_id: "session-1", locale: "en", question: "question", request_id: "x".repeat(101) },
  ]) {
    let executed = false;
    const response = await handleTarotClarificationRoute({
      loadBody: async () => body,
      execute: async () => { executed = true; return { result }; },
      log: () => undefined,
    });
    assert.equal(response.status, 400);
    assert.equal(executed, false);
    assert.deepEqual(await json(response), { error: "Invalid Tarot clarification request." });
  }
});

test("maps clarification service/provider failures without logging question content", async () => {
  const secret = "PRIVATE_CLARIFICATION_QUESTION";
  for (const [error, expectedStatus, expectedMessage] of [
    [new TarotClarificationServiceError("not_found", "private"), 404, "Reading session not found."],
    [new TarotClarificationServiceError("invalid_request", "private"), 400, "Invalid Tarot clarification request."],
    [new TarotClarificationServiceError("incomplete", "private"), 409, "This reading is not ready for clarification."],
    [new TarotClarificationServiceError("limit", "private"), 409, "This reading has reached its clarification limit."],
    [new TarotClarificationServiceError("persistence", "private"), 503, "The Tarot clarification could not be saved. Please try again."],
    [new TarotAIError("invalid_response", secret, { retryable: true }), 503, "Tarot clarification is temporarily unavailable. Please try again."],
  ] as const) {
    const events: unknown[] = [];
    const response = await handleTarotClarificationRoute({
      loadBody: async () => ({ session_id: "session-1", locale: "vi", question: secret, request_id: "request-1" }),
      execute: async () => { throw error; },
      log: (event) => events.push(event),
    });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await json(response), { error: expectedMessage });
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE_CLARIFICATION_QUESTION/);
  }
});
