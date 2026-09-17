export type TarotLocale = "en" | "vi";
export type TarotOrientation = "upright" | "reversed";
export type TarotProviderId = "openai" | "gemini" | "deepseek";

export type TarotMeaningEvidence = {
  summary: string;
  energy: string;
  actions: string[];
  relationships: string;
  work: string;
  creativity: string;
  home: string;
  symbolism: string;
  journalQuestions: string[];
  keywords: string[];
};

export type TarotReadingCardContext = {
  readingCardId: string;
  orientation: TarotOrientation;
  position: { id: string; key: string; order: number; name: string; meaning: string; prompt: string };
  card: { id: string; nameEn: string; nameVi: string; arcana: string; suit: string | null; keywords: string[] };
  knowledge: { upright: TarotMeaningEvidence; reversed: TarotMeaningEvidence };
};

export type TarotReadingInput = {
  locale: TarotLocale;
  question: string;
  optionalContext: string | null;
  category: { id: string; key: string; name: string } | null;
  spread: { id: string; key: string; name: string; description: string };
  cards: TarotReadingCardContext[];
};

export type TarotProviderCard = {
  reading_card_id: string;
  position_key: string;
  interpretation: string;
  reflection_prompt: string;
};

export type TarotProviderOutput = {
  overview: string;
  cards: TarotProviderCard[];
  connections: string;
  guidance: string;
  closing: string;
};

export type TarotReadingCard = TarotProviderCard & {
  position: TarotReadingCardContext["position"];
  card: TarotReadingCardContext["card"];
  orientation: TarotOrientation;
};

export type TarotReadingPayload = {
  overview: string;
  cards: TarotReadingCard[];
  connections: string;
  guidance: string;
  closing: string;
  disclaimer: string;
};
