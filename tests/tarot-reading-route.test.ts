import assert from "node:assert/strict";
import test from "node:test";
import { TarotAIError } from "../lib/ai/provider";
import { handleTarotReadingRoute } from "../lib/tarot-reading-route";
import { TarotReadingServiceError } from "../lib/tarot-reading-service";

const canonicalResult = {
  sessionId: "session-runtime",
  locale: "en" as const,
  source: "ai" as const,
  provider: "openai" as const,
  modelName: "openai:gpt-test",
  promptVersion: "tarot-reading-v4.1",
  reading: {
    directAnswer: "A grounded direct answer.\n\nA grounded next step.",
    personalInsights: [{ title: "A pattern", body: "A grounded pattern." }],
    reflectionPrompts: ["What is ready to change?"],
    nextSteps: [{ title: "One step", body: "Take one considered step." }],
    cardEvidence: [
      {
        readingCardId: "reading-card-1",
        position: {
          id: "position-present",
          key: "present",
          order: 0,
          name: "Present",
          meaning: "The current energy.",
          prompt: "What is present?",
        },
        card: {
          id: "major-fool",
          nameEn: "The Fool",
          nameVi: "The Fool",
          arcana: "major",
          suit: null,
          keywords: ["beginning"],
        },
        orientation: "upright" as const,
        interpretation: "Notice the present pattern.",
      },
    ],
    deeperReading: null,
    followUpSuggestions: ["Explore the pattern."],
    disclaimer: "Use this reading as reflective guidance.",
  },
};

async function readJson(response: Response) {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

test("returns a real 400 JSON response and metadata-only log for an invalid request", async () => {
  const events: unknown[] = [];
  let executed = false;
  const secret = "PRIVATE_INVALID_BODY_MARKER";

  const response = await handleTarotReadingRoute({
    loadBody: async () => ({
      session_id: "",
      locale: "fr",
      question: secret,
      optionalContext: secret,
      prompt: secret,
      apiKey: secret,
      rawBody: secret,
    }),
    execute: async () => {
      executed = true;
      return { result: canonicalResult };
    },
    log: (event) => events.push(event),
    now: () => 25,
  });

  assert.equal(executed, false);
  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") || "", /^application\/json/);
  assert.deepEqual(await readJson(response), { error: "Invalid Tarot reading request." });
  assert.deepEqual(events, [{
    status: "failure",
    httpStatus: 400,
    failureCategory: "invalid_request",
    promptVersion: "tarot-reading-v4.1",
    latencyMs: 0,
  }]);
  assert.equal(JSON.stringify(events).includes(secret), false);
});

test("maps configuration, upstream, and invalid-response provider failures to safe 503 responses", async (t) => {
  const cases = [
    ["configuration", "Tarot reading is not configured yet. Please try again later."],
    ["upstream", "Tarot reading is temporarily unavailable. Please try again."],
    ["invalid_response", "Tarot reading is temporarily unavailable. Please try again."],
  ] as const;

  for (const [code, message] of cases) {
    await t.test(code, async () => {
      const events: unknown[] = [];
      const secret = `provider exception ${code}: PRIVATE_EXCEPTION_MARKER raw-body`;
      const response = await handleTarotReadingRoute({
        loadBody: async () => ({ session_id: "session-runtime", locale: "en" }),
        execute: async (_input, metadata) => {
          metadata.provider = "openai";
          metadata.modelName = "openai:gpt-test";
          throw new TarotAIError(code, secret, { retryable: code !== "configuration" });
        },
        log: (event) => events.push(event),
        now: () => 50,
      });

      assert.equal(response.status, 503);
      assert.deepEqual(await readJson(response), { error: message });
      assert.deepEqual(events, [{
        status: "failure",
        httpStatus: 503,
        failureCategory: `provider_${code}`,
        sessionId: "session-runtime",
        provider: "openai",
        modelName: "openai:gpt-test",
        promptVersion: "tarot-reading-v4.1",
        latencyMs: 0,
      }]);
      assert.equal(JSON.stringify(events).includes(secret), false);
    });
  }
});

test("maps not-found, incomplete, and persistence service failures to their HTTP contracts", async (t) => {
  const cases = [
    ["not_found", 404, "Reading session not found."],
    ["incomplete", 409, "This reading is not ready to interpret."],
    ["persistence", 503, "The Tarot reading could not be saved. Please try again."],
  ] as const;

  for (const [code, status, message] of cases) {
    await t.test(code, async () => {
      const events: unknown[] = [];
      const response = await handleTarotReadingRoute({
        loadBody: async () => ({ session_id: "session-runtime", locale: "vi" }),
        execute: async (_input, metadata) => {
          metadata.provider = "gemini";
          metadata.modelName = "gemini:model-test";
          throw new TarotReadingServiceError(code, "private exception text");
        },
        log: (event) => events.push(event),
        now: () => 75,
      });

      assert.equal(response.status, status);
      assert.deepEqual(await readJson(response), { error: message });
      assert.deepEqual(events, [{
        status: "failure",
        httpStatus: status,
        failureCategory: `service_${code}`,
        sessionId: "session-runtime",
        provider: "gemini",
        modelName: "gemini:model-test",
        promptVersion: "tarot-reading-v4.1",
        latencyMs: 0,
      }]);
    });
  }
});

test("returns canonical success metadata and passes Set-Cookie through", async () => {
  const events: unknown[] = [];
  const response = await handleTarotReadingRoute({
    loadBody: async () => ({ session_id: canonicalResult.sessionId, locale: canonicalResult.locale }),
    execute: async (_input, metadata) => {
      metadata.provider = canonicalResult.provider;
      metadata.modelName = canonicalResult.modelName;
      return { result: canonicalResult, setCookie: "vintarot_guest=guest-1; HttpOnly; Path=/; SameSite=Lax" };
    },
    log: (event) => events.push(event),
    now: () => 100,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), "vintarot_guest=guest-1; HttpOnly; Path=/; SameSite=Lax");
  assert.match(response.headers.get("content-type") || "", /^application\/json/);
  const responseBody = await readJson(response);
  assert.match(String((responseBody.reading as Record<string, unknown>).directAnswer), /grounded direct answer/);
  assert.equal(((responseBody.reading as Record<string, unknown>).cardEvidence as unknown[]).length, 1);
  assert.equal((((responseBody.reading as Record<string, unknown>).cardEvidence as Array<Record<string, unknown>>)[0].position as Record<string, unknown>).key, "present");
  assert.deepEqual(responseBody, {
    session_id: canonicalResult.sessionId,
    locale: canonicalResult.locale,
    source: "ai",
    provider: "openai",
    model_name: "openai:gpt-test",
    prompt_version: "tarot-reading-v4.1",
    reading: canonicalResult.reading,
  });
  assert.deepEqual(events, [{
    status: "success",
    httpStatus: 200,
    sessionId: "session-runtime",
    provider: "openai",
    modelName: "openai:gpt-test",
    promptVersion: "tarot-reading-v4.1",
    cardCount: 1,
    latencyMs: 0,
  }]);
  assert.equal(JSON.stringify(responseBody).includes("PRIVATE_"), false);
});

test("rethrows request rejection responses after logging only allowlisted metadata", async () => {
  const events: unknown[] = [];
  const rejection = Response.json({ error: "Origin not allowed" }, { status: 403 });

  await assert.rejects(
    handleTarotReadingRoute({
      loadBody: async () => { throw rejection; },
      execute: async () => ({ result: canonicalResult }),
      log: (event) => events.push(event),
      now: () => 125,
    }),
    (error) => error === rejection,
  );
  assert.deepEqual(events, [{
    status: "failure",
    httpStatus: 403,
    failureCategory: "request_rejected",
    sessionId: undefined,
    provider: undefined,
    modelName: undefined,
    promptVersion: "tarot-reading-v4.1",
    latencyMs: 0,
  }]);
});
