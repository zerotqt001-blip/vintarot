import { z } from "zod";
import type { TarotLocale, TarotOrientation } from "./tarot-catalog";

export const PROMPT_VERSION = "tarot-reading-v1";

const cardReadingSchema = z.object({
  reading_card_id: z.string().min(1).max(100),
  position_key: z.string().min(1).max(100),
  interpretation: z.string().min(1).max(4000),
  reflection_prompt: z.string().min(1).max(1000),
});

const readingPayloadSchema = z.object({
  opening: z.string().min(1).max(2000),
  card_readings: z.array(cardReadingSchema).max(10),
  synthesis: z.string().min(1).max(4000),
  advice: z.string().min(1).max(3000),
  closing: z.string().min(1).max(2000),
  disclaimer: z.string().min(1).max(800),
});

export type ReadingPayload = z.infer<typeof readingPayloadSchema>;

export type MeaningEvidence = {
  summary: string;
  actions: string;
  journalQuestions: string[];
  energy?: string;
  relationships?: string;
  work?: string;
  creativity?: string;
  home?: string;
  symbolism?: string;
  keywords?: string;
};

export type InterpretationCardInput = {
  readingCardId: string;
  positionKey: string;
  positionLabel: string;
  positionPrompt: string;
  orientation: TarotOrientation;
  meaning: MeaningEvidence;
};

export type LocalReadingInput = {
  locale: TarotLocale;
  question: string;
  optionalContext?: string;
  cards: InterpretationCardInput[];
};

export type InterpretationResult = {
  source: "ai" | "local-fallback";
  modelName: string;
  promptVersion: string;
  reading: ReadingPayload;
};

export type ProviderRequest = {
  locale: TarotLocale;
  question: string;
  optionalContext: string;
  cards: InterpretationCardInput[];
};

export type InterpretationProvider = (request: ProviderRequest) => Promise<unknown>;

export type InterpretationProviderConfig = {
  url: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

const disclaimer = {
  en: "This is a reflective reading, not a certain prediction or professional advice.",
  vi: "Đây là một lời mời để phản chiếu, không phải lời tiên đoán chắc chắn hay lời khuyên chuyên môn.",
} as const;

const copy = {
  en: {
    opening: (question: string) => `For “${question}”, let this spread be a way to notice what is already asking for attention.`,
    interpretation: (label: string, summary: string, actions: string) => `${label}: ${summary} A grounded response could be ${actions.toLowerCase()}`,
    prompt: (prompt: string, question: string) => prompt || `What do you notice about “${question}” when you stay with this position?`,
    synthesis: "Taken together, these cards offer angles to explore rather than a fixed answer. Notice the thread that feels most honest and useful.",
    advice: "Choose one small, kind action that you can revisit. Let the reading support your agency instead of replacing it.",
    closing: "Return to the cards when the question changes shape. Your observations are part of the reading.",
  },
  vi: {
    opening: (question: string) => `Với câu hỏi “${question}”, hãy xem trải bài như một cách nhận ra điều đang muốn được chú ý.`,
    interpretation: (label: string, summary: string, actions: string) => `${label}: ${summary} Một cách đáp lại vững vàng có thể là ${actions.toLowerCase()}`,
    prompt: (prompt: string, question: string) => prompt || `Bạn nhận ra điều gì về “${question}” khi ở lại với vị trí này?`,
    synthesis: "Đặt cạnh nhau, các lá bài mở ra những góc nhìn để khám phá chứ không phải một đáp án cố định. Hãy chú ý đến mạch cảm nhận chân thật và hữu ích nhất.",
    advice: "Chọn một hành động nhỏ và tử tế mà bạn có thể quay lại kiểm chứng. Hãy để trải bài hỗ trợ quyền lựa chọn của bạn, không thay thế nó.",
    closing: "Hãy trở lại với các lá bài khi câu hỏi đổi hình dạng. Những điều bạn quan sát được cũng là một phần của trải bài.",
  },
} as const;

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function parseReadingPayload(value: unknown, expectedReadingCardIds: string[]): ReadingPayload {
  const parsed = readingPayloadSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid reading payload: ${parsed.error.issues[0]?.path.join(".") || "reading"}`);
  const expected = [...new Set(expectedReadingCardIds)];
  const actual = parsed.data.card_readings.map((reading) => reading.reading_card_id);
  if (expected.length !== expectedReadingCardIds.length || actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some((id) => !expected.includes(id))) {
    throw new Error("Invalid card_readings coverage for the session");
  }
  const byId = new Map(parsed.data.card_readings.map((reading) => [reading.reading_card_id, reading]));
  return { ...parsed.data, card_readings: expected.map((id) => byId.get(id)!) };
}

export function buildLocalReading(input: LocalReadingInput): InterpretationResult {
  const language = copy[input.locale];
  const question = clean(input.question || (input.locale === "vi" ? "Điều gì cần tôi chú ý lúc này?" : "What deserves my attention right now?"), 500);
  const cards = input.cards.map((card) => ({
    reading_card_id: card.readingCardId,
    position_key: card.positionKey,
    interpretation: clean(language.interpretation(card.positionLabel, card.meaning.summary, card.meaning.actions), 4000),
    reflection_prompt: clean(language.prompt(card.positionPrompt || card.meaning.journalQuestions[0] || "", question), 1000),
  }));
  const reading = parseReadingPayload({
    opening: language.opening(question),
    card_readings: cards,
    synthesis: language.synthesis,
    advice: language.advice,
    closing: language.closing,
    disclaimer: disclaimer[input.locale],
  }, input.cards.map((card) => card.readingCardId));
  return { source: "local-fallback", modelName: "local-narrative", promptVersion: PROMPT_VERSION, reading };
}

export function buildProviderPrompt(input: ProviderRequest): string {
  const evidence = input.cards.map((card) => JSON.stringify({
    reading_card_id: card.readingCardId,
    position_key: card.positionKey,
    position_label: card.positionLabel,
    position_prompt: card.positionPrompt,
    orientation: card.orientation,
    summary: card.meaning.summary,
    actions: card.meaning.actions,
    journal_questions: card.meaning.journalQuestions.slice(0, 2),
  })).join("\n");
  return [
    "Write a bounded, reflective tarot reading. Do not predict certainty or give medical, legal, or financial advice.",
    `Locale: ${input.locale}. Question: ${clean(input.question, 500)}`,
    `Optional context: ${clean(input.optionalContext, 5000)}`,
    "Return JSON only with opening, card_readings, synthesis, advice, closing, disclaimer.",
    "Each card_readings item must preserve reading_card_id and position_key and include interpretation and reflection_prompt.",
    evidence,
  ].join("\n");
}

function providerJson(value: any): unknown {
  const content = value?.choices?.[0]?.message?.content ?? value?.output ?? value;
  if (typeof content !== "string") return content;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || content;
  return JSON.parse(fenced);
}

export function createInterpretationProvider(config?: InterpretationProviderConfig | null): InterpretationProvider | null {
  if (!config?.url || !config.apiKey || !config.model) return null;
  return async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(config.timeoutMs || 12000, 20000)));
    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, temperature: 0.35, response_format: { type: "json_object" }, messages: [{ role: "user", content: buildProviderPrompt(request) }] }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Provider request failed");
      return providerJson(await response.json());
    } finally {
      clearTimeout(timer);
    }
  };
}

