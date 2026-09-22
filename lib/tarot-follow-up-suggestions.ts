import type { TarotLocale, TarotReadingPayload } from "./ai/types";

const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_LENGTH = 500;

const REDRAW_PATTERNS = [
  /\b(?:draw|pull|pick|reveal|shuffle|deal)\b.{0,80}\b(?:another|more|again|card|cards|tarot|reading)\b/iu,
  /\b(?:another|more|again|repeat)\b.{0,80}\b(?:card|cards|tarot|reading)\b/iu,
  /\b(?:card|cards|tarot|reading)\b.{0,80}\b(?:another|more|again|repeat)\b/iu,
  /(?:rút|bốc|kéo).{0,80}(?:thêm|lại|khác).{0,80}(?:lá|bài)?/iu,
  /(?:lá|bài).{0,80}(?:thêm|nữa|khác|lại)/iu,
  /(?:trải|xem|hỏi).{0,50}(?:lại|thêm).{0,50}(?:bài|tarot|lá)?/iu,
];

const QUESTION_STARTS = [
  /^(?:what|how|why|when|where|which|who|could|should|would|can|may|if|is|are|do|does)\b/iu,
  /^(?:điều gì|làm thế nào|vì sao|tại sao|khi nào|ở đâu|nên|có thể|liệu|có phải|nếu|bạn|mình|tôi)\b/iu,
];

function compact(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function fragment(value: string): string {
  return compact(value).replace(/[.!?]+$/u, "").slice(0, 160).trim();
}

function isQuestionShaped(value: string): boolean {
  return value.endsWith("?") || QUESTION_STARTS.some((pattern) => pattern.test(value));
}

function isRedrawSuggestion(value: string): boolean {
  return REDRAW_PATTERNS.some((pattern) => pattern.test(value));
}

function addSuggestion(result: string[], seen: Set<string>, value: string): void {
  const candidate = compact(value).slice(0, MAX_SUGGESTION_LENGTH).trim();
  if (!candidate || !isQuestionShaped(candidate) || isRedrawSuggestion(candidate)) return;
  const key = candidate.toLocaleLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  result.push(candidate);
}

function contextualCandidates(reading: TarotReadingPayload, locale: TarotLocale): string[] {
  const candidates: string[] = [];
  const insight = reading.personalInsights.find((item) => fragment(item.title || item.body));
  const nextStep = reading.nextSteps.find((item) => fragment(item.title || item.body));
  const position = reading.cardEvidence.find((item) => fragment(item.position.name));

  if (locale === "vi") {
    if (insight) candidates.push(`Nếu nhìn kỹ hơn vào "${fragment(insight.title || insight.body)}", điều gì có thể thay đổi?`);
    if (nextStep) candidates.push(`Tôi có thể thử "${fragment(nextStep.title || nextStep.body)}" theo cách thực tế nào?`);
    if (position) candidates.push(`Trong thực tế, tôi có thể đáp lại vị trí "${fragment(position.position.name)}" như thế nào?`);
  } else {
    if (insight) candidates.push(`What might change if I look more closely at "${fragment(insight.title || insight.body)}"?`);
    if (nextStep) candidates.push(`How could I try "${fragment(nextStep.title || nextStep.body)}" in a grounded way?`);
    if (position) candidates.push(`What would responding to "${fragment(position.position.name)}" look like in practice?`);
  }
  return candidates;
}

export function selectContextualFollowUpSuggestions(
  reading: TarotReadingPayload,
  question: string,
  locale: TarotLocale,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const suggestion of reading.followUpSuggestions) {
    addSuggestion(result, seen, suggestion);
    if (result.length === MAX_SUGGESTIONS) return result;
  }
  for (const suggestion of contextualCandidates(reading, locale)) {
    addSuggestion(result, seen, suggestion);
    if (result.length === MAX_SUGGESTIONS) return result;
  }
  addSuggestion(result, seen, question);
  return result.slice(0, MAX_SUGGESTIONS);
}
