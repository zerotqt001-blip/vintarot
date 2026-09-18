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

export type TarotProviderInsight = {
  title: string;
  body: string;
};

export type TarotProviderNextStep = {
  title: string;
  body: string;
};

export type TarotProviderCardEvidence = {
  reading_card_id: string;
  position_key: string;
  interpretation: string;
};

export type TarotProviderOutputV3 = {
  direct_answer: string;
  personal_insights: TarotProviderInsight[];
  reflection_prompts: string[];
  next_steps: TarotProviderNextStep[];
  card_evidence: TarotProviderCardEvidence[];
  deeper_reading: string | null;
  follow_up_suggestions: string[];
};

export type TarotReadingPayload = {
  directAnswer: string;
  personalInsights: TarotProviderInsight[];
  reflectionPrompts: string[];
  nextSteps: TarotProviderNextStep[];
  cardEvidence: Array<{
    readingCardId: string;
    position: TarotReadingCardContext["position"];
    card: TarotReadingCardContext["card"];
    orientation: TarotOrientation;
    interpretation: string;
  }>;
  deeperReading: string | null;
  followUpSuggestions: string[];
  disclaimer: string;
};
