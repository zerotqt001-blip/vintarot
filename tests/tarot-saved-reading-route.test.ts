import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const directory = mkdtempSync(join(tmpdir(), "natarot-saved-route-"));
process.env.NATAROT_DB_PATH = join(directory, "saved-readings.sqlite");
const { GET, POST } = await import("../app/api/tarot/saved-readings/route");

test.after(() => rmSync(directory, { recursive: true, force: true }));

test("guest save and history requests require authentication without creating records", async () => {
  const postResponse = await POST(new Request("https://natarot.test/api/tarot/saved-readings", {
    method: "POST",
    headers: { origin: "https://natarot.test", "content-type": "application/json" },
    body: JSON.stringify({ reading_id: "reading-1", session_id: "session-1" }),
  }));
  assert.equal(postResponse.status, 401);
  assert.deepEqual(await postResponse.json(), { error: "Sign in to save this reading." });

  const getResponse = await GET(new Request("https://natarot.test/api/tarot/saved-readings"));
  assert.equal(getResponse.status, 401);
  assert.deepEqual(await getResponse.json(), { error: "Sign in to open saved readings." });
});
test("saved-reading route has no provider or regeneration dependency", () => {
  const source = readFileSync(new URL("../app/api/tarot/saved-readings/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /createTarotAIProvider|generateTarotReading|DEEPSEEK_API_KEY/);
});
