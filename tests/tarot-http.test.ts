import assert from "node:assert/strict";
import test from "node:test";
import { createTarotHTTPClient } from "../lib/ai/http";
import { TarotAIError } from "../lib/ai/provider";

async function rejectsWithResponse(status: number, body = "provider private body") {
  const request = createTarotHTTPClient({
    timeoutMs: 1_000,
    fetch: async () => new Response(body, { status }),
  });
  await assert.rejects(
    () => request("https://provider.test/chat", { method: "POST" }),
    (error: unknown) => {
      assert.ok(error instanceof TarotAIError);
      assert.equal(error.code, "upstream");
      assert.equal(error.httpStatus, status);
      assert.equal(error.message.includes(body), false);
      return true;
    },
  );
}

test("preserves provider auth status without exposing the response body", async () => {
  await rejectsWithResponse(401, "PRIVATE_API_KEY_REJECTED");
  await rejectsWithResponse(403, "PRIVATE_ACCOUNT_DETAIL");
});

test("preserves rate-limit and provider failure status for safe classification", async () => {
  await rejectsWithResponse(429);
  await rejectsWithResponse(503);
});

test("classifies an aborted provider request as a timeout", async () => {
  const request = createTarotHTTPClient({
    timeoutMs: 1_000,
    fetch: async (_input, init) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1_100));
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return new Response("unexpected", { status: 200 });
    },
  });

  await assert.rejects(
    () => request("https://provider.test/chat", { method: "POST" }),
    (error: unknown) => error instanceof TarotAIError && error.code === "timeout",
  );
});

test("classifies malformed successful provider JSON as invalid response", async () => {
  const request = createTarotHTTPClient({
    timeoutMs: 1_000,
    fetch: async () => new Response("{not-json", { status: 200 }),
  });

  await assert.rejects(
    () => request("https://provider.test/chat", { method: "POST" }),
    (error: unknown) => error instanceof TarotAIError
      && error.code === "invalid_response"
      && error.failureStage === "provider_http_json_invalid",
  );
});
