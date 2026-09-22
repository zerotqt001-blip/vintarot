import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProviderProbe,
  parseEnvironmentFilePaths,
  readConfiguredIdentifiers,
  validateSyntheticReading,
} from "../scripts/production-ai-health-gate.mjs";

test("parses systemd environment-file metadata without reading secret values", () => {
  assert.deepEqual(
    parseEnvironmentFilePaths("/etc/natarot.env (ignore_errors=yes) /etc/other.env"),
    ["/etc/natarot.env", "/etc/other.env"],
  );
});

test("reports only safe provider and model identifiers", () => {
  const result = readConfiguredIdentifiers({
    TAROT_AI_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "PRIVATE_DEEPSEEK_KEY",
    DEEPSEEK_TAROT_MODEL: "deepseek-flash",
  });
  assert.deepEqual(result, { status: "PASS", provider: "deepseek", model: "deepseek-flash" });
  assert.equal(JSON.stringify(result).includes("PRIVATE_DEEPSEEK_KEY"), false);
  assert.equal(readConfiguredIdentifiers({ TAROT_AI_PROVIDER: "deepseek" }).status, "FAIL");
});

test("classifies provider probes without exposing response bodies", () => {
  assert.equal(classifyProviderProbe(200), "PASS");
  assert.equal(classifyProviderProbe(401), "AUTH_FAILED");
  assert.equal(classifyProviderProbe(503), "FAIL");
});

test("validates a synthetic guest reading using safe metadata only", () => {
  assert.deepEqual(validateSyntheticReading({
    provider: "deepseek",
    model_name: "deepseek:deepseek-flash",
    prompt_version: "tarot-reading-v4.2.2",
    reading: { cardEvidence: [{}, {}, {}] },
    error: "",
  }), {
    status: "PASS",
    provider: "deepseek",
    model: "deepseek:deepseek-flash",
    promptVersion: "tarot-reading-v4.2.2",
    cardEvidenceCount: 3,
  });
  assert.throws(() => validateSyntheticReading({ error: "private upstream response" }), /synthetic reading/i);
});
