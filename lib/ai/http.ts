import { TarotAIError } from "./provider";

export type TarotFetch = typeof fetch;

export type TarotHTTPDependencies = {
  fetch?: TarotFetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 20_000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

async function consumeResponse(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // The original response details are intentionally discarded.
  }
}

export function createTarotHTTPClient(dependencies: TarotHTTPDependencies = {}) {
  const fetchFn = dependencies.fetch ?? globalThis.fetch;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TarotAIError(
      "configuration",
      `Tarot AI timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds.`,
    );
  }

  return async function request(input: string | URL | Request, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchFn(input, { ...init, signal: controller.signal });
        if (response.ok) return response;

        await consumeResponse(response);
        const retryable = RETRYABLE_STATUSES.has(response.status);
        if (retryable && attempt === 0) continue;

        throw new TarotAIError(
          "upstream",
          `Tarot AI provider request failed with status ${response.status}.`,
          { retryable },
        );
      } catch (error) {
        if (error instanceof TarotAIError) throw error;

        const timedOut = controller.signal.aborted;
        if (attempt === 0) continue;

        throw new TarotAIError(
          timedOut ? "timeout" : "upstream",
          timedOut ? "Tarot AI provider request timed out." : "Tarot AI provider request failed.",
          { retryable: true },
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new TarotAIError("upstream", "Tarot AI provider request failed.", { retryable: true });
  };
}
