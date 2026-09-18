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
  /** Selective V5 handbook evidence; these fields never contain provider output. */
  core?: string;
  contextRule?: string;
  positionModifier?: string;
  reversalGuidance?: string;
  cautions?: string[];
  interpretationChecks?: string[];
  masterSemantics?: string[];
};

export type TarotRetrievedGuidance = {
  method: string[];
  domain: string[];
  reversal: string[];
  synthesis: string[];
  safety: string[];
};

export type TarotCombinationHint = {
  kind: "pair" | "triad";
  cards: string[];
  signals: string[];
  cautions: string[];
  relationship?: string;
};

export type TarotFewShotExample = {
  id: string;
  language: TarotLocale;
  domain: string;
  question: string;
  spread: string;
  cards: string[];
  overview: string;
  connections: string;
  guidance: string;
  closing: string;
};

export type TarotReadingCardContext = {
  readingCardId: string;
  orientation: TarotOrientation;
  position: { id: string; key: string; order: number; name: string; meaning: string; prompt: string };
  card: { id: string; nameEn: string; nameVi: string; arcana: string; suit: string | null; keywords: string[] };
  knowledge: { upright: TarotMeaningEvidence; reversed: TarotMeaningEvidence };
};

export type TarotReadingInput = {
  knowledgeVersion: "5.0";
  domain: string;
  locale: TarotLocale;
  question: string;
  optionalContext: string | null;
  category: { id: string; key: string; name: string } | null;
  spread: { id: string; key: string; name: string; description: string };
  cards: TarotReadingCardContext[];
  retrievedGuidance: TarotRetrievedGuidance;
  combinationHints: TarotCombinationHint[];
  fewShotExamples: TarotFewShotExample[];
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
