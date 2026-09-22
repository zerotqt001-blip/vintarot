#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const DEFAULT_ORIGIN = "https://natarot.com";
const DEFAULT_SERVICE = "natarot.service";
const DEFAULT_TIMEOUT_MS = 20_000;
const REQUIRED_ENV_NAMES = ["TAROT_AI_PROVIDER", "DEEPSEEK_API_KEY", "DEEPSEEK_TAROT_MODEL"];

export function parseEnvironmentFilePaths(value) {
  return String(value || "")
    .split(/\s+/)
    .map((token) => token.replace(/\s*\(.*\)$/, ""))
    .filter((token) => token.startsWith("/"));
}

export function readConfiguredIdentifiers(env) {
  const provider = typeof env?.TAROT_AI_PROVIDER === "string" ? env.TAROT_AI_PROVIDER.trim().toLowerCase() : "";
  const model = typeof env?.DEEPSEEK_TAROT_MODEL === "string" ? env.DEEPSEEK_TAROT_MODEL.trim() : "";
  const key = typeof env?.DEEPSEEK_API_KEY === "string" ? env.DEEPSEEK_API_KEY.trim() : "";
  if (provider !== "deepseek" || !model || !key) return { status: "FAIL" };
  return { status: "PASS", provider, model };
}

export function classifyProviderProbe(status) {
  if (status === 200) return "PASS";
  if (status === 401 || status === 403) return "AUTH_FAILED";
  return "FAIL";
}

export function validateSyntheticReading(body) {
  const reading = body && typeof body === "object" && body.reading && typeof body.reading === "object"
    ? body.reading
    : null;
  const cardEvidence = reading && Array.isArray(reading.cardEvidence) ? reading.cardEvidence : [];
  const provider = typeof body?.provider === "string" ? body.provider.trim() : "";
  const model = typeof body?.model_name === "string" ? body.model_name.trim() : "";
  const promptVersion = typeof body?.prompt_version === "string" ? body.prompt_version.trim() : "";
  if (body?.error || !provider || !model || !promptVersion || cardEvidence.length < 1) {
    throw new Error("Synthetic reading did not satisfy the safe response contract.");
  }
  return {
    status: "PASS",
    provider,
    model,
    promptVersion,
    cardEvidenceCount: cardEvidence.length,
  };
}

function commandOutput(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function environmentFromBuffer(buffer) {
  return Object.fromEntries(String(buffer).split("\0").filter(Boolean).map((entry) => {
    const separator = entry.indexOf("=");
    return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
}

function environmentNamesFromText(text) {
  return new Set(String(text).split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return match ? [match[1]] : [];
  }));
}

function safeCookieHeader(response) {
  const headers = response.headers;
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie") || ""];
  const cookie = values.find((value) => value.startsWith("vintarot_guest="));
  return cookie ? cookie.split(";", 1)[0] : "";
}

function withTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.resolve()
    .then(() => fetchImpl(url, { ...options, signal: controller.signal }))
    .finally(() => clearTimeout(timer));
}

async function jsonBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function runGuestReading({ origin, fetchImpl, timeoutMs, index }) {
  const drawResponse = await withTimeout(fetchImpl, `${origin}/api/tarot/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: `Production health gate ${index}`,
      optional_context: "synthetic operator health check",
      category_id: "category-everyday",
      spread_template_id: "spread-everyday-persona-obstacle-solution",
      deck_id: "deck-rider-waite-smith",
      locale: "en",
      reversals: true,
      selected_cards: [
        { card_number: 0, orientation: "upright" },
        { card_number: 1, orientation: "upright" },
        { card_number: 2, orientation: "upright" },
      ],
    }),
  }, timeoutMs);
  const drawBody = await jsonBody(drawResponse);
  const sessionId = typeof drawBody?.session_id === "string" ? drawBody.session_id : "";
  const cookie = safeCookieHeader(drawResponse);
  if (drawResponse.status !== 201 || !sessionId || !cookie) {
    throw new Error("Synthetic guest draw failed.");
  }

  const readingResponse = await withTimeout(fetchImpl, `${origin}/api/tarot/reading`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ session_id: sessionId, locale: "en" }),
  }, timeoutMs);
  const readingBody = await jsonBody(readingResponse);
  if (readingResponse.status !== 200) throw new Error("Synthetic guest reading returned a non-success status.");
  return validateSyntheticReading(readingBody);
}

export async function runHealthGate({
  origin = DEFAULT_ORIGIN,
  service = DEFAULT_SERVICE,
  readings = 1,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  command = commandOutput,
  readFile = readFileSync,
  fetchImpl = globalThis.fetch,
  report = console.log,
} = {}) {
  const mainPid = command("systemctl", ["show", "--property=MainPID", "--value", service]);
  if (!/^\d+$/.test(mainPid) || Number(mainPid) < 1) throw new Error("The production service has no active process.");
  report(`GATE service=PASS pid=${mainPid}`);

  const processEnv = environmentFromBuffer(readFile(`/proc/${mainPid}/environ`));
  const identifiers = readConfiguredIdentifiers(processEnv);
  if (identifiers.status !== "PASS") throw new Error("The active service process is missing required DeepSeek configuration.");
  report(`GATE process_config=PASS provider=${identifiers.provider} model=${identifiers.model}`);

  const environmentFiles = parseEnvironmentFilePaths(command("systemctl", ["show", "--property=EnvironmentFiles", "--value", service]));
  const envFile = environmentFiles.find((path) => path === "/etc/natarot.env") || environmentFiles[0];
  if (!envFile) throw new Error("The production service has no persistent environment file.");
  const envFileNames = environmentNamesFromText(readFile(envFile, "utf8"));
  const missingNames = REQUIRED_ENV_NAMES.filter((name) => !envFileNames.has(name));
  if (missingNames.length) throw new Error("The persistent environment file is missing required configuration names.");
  report(`GATE persistent_config=PASS env_file=${envFile}`);

  const providerKey = processEnv.DEEPSEEK_API_KEY;
  const providerResponse = await withTimeout(fetchImpl, "https://api.deepseek.com/models", {
    headers: { Authorization: `Bearer ${providerKey}` },
  }, timeoutMs);
  const providerStatus = classifyProviderProbe(providerResponse.status);
  if (providerStatus !== "PASS") throw new Error(`DeepSeek provider probe failed: ${providerStatus}.`);
  report(`GATE deepseek_models=PASS status=${providerResponse.status}`);

  const healthResponse = await withTimeout(fetchImpl, `${origin.replace(/\/$/, "")}/api/health`, {}, timeoutMs);
  const healthBody = await jsonBody(healthResponse);
  if (healthResponse.status !== 200 || healthBody?.status !== "ok") throw new Error("The public web health check failed.");
  report(`GATE web_health=PASS status=${healthResponse.status}`);

  const count = Math.max(1, Math.min(5, Number(readings) || 1));
  for (let index = 1; index <= count; index += 1) {
    const result = await runGuestReading({ origin: origin.replace(/\/$/, ""), fetchImpl, timeoutMs, index });
    report(`GATE guest_reading_${index}=PASS provider=${result.provider} model=${result.model} prompt=${result.promptVersion} cards=${result.cardEvidenceCount}`);
  }
  report(`RESULT PASS readings=${count}`);
  return { status: "PASS", readings: count, provider: identifiers.provider, model: identifiers.model };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--origin") options.origin = argv[++index];
    else if (arg === "--service") options.service = argv[++index];
    else if (arg === "--readings") options.readings = Number(argv[++index]);
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
  }
  return options;
}

async function main() {
  try {
    await runHealthGate(parseArgs(process.argv.slice(2)));
  } catch (error) {
    const message = error?.message || "unknown";
    const category = /DeepSeek provider probe/i.test(message)
      ? "provider"
      : /health/i.test(message)
        ? "web_health"
        : /reading|draw/i.test(message)
          ? "guest_reading"
          : "configuration";
    console.error(`RESULT FAIL gate=${category}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  await main();
}
