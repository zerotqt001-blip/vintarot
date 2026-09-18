import type { TarotMeaningEvidence, TarotProviderOutputV3, TarotReadingInput } from "../../lib/ai/types";

function evidence(label: string): TarotMeaningEvidence {
  return {
    summary: `${label} summary`,
    energy: `${label} energy`,
    actions: [`${label} action`],
    relationships: `${label} relationships`,
    work: `${label} work`,
    creativity: `${label} creativity`,
    home: `${label} home`,
    symbolism: `${label} symbolism`,
    journalQuestions: [`${label} journal question`],
    keywords: [label.toLowerCase()],
  };
}

export const tarotReadingQualityFixture: TarotReadingInput = {
  knowledgeVersion: "5.0",
  domain: "love",
  locale: "vi",
  question: "Xu hướng 3 tháng tới của mối quan hệ này như thế nào?",
  optionalContext: "Chúng tôi muốn nhìn rõ hướng phát triển mà không dựa vào dự đoán chắc chắn.",
  category: { id: "relationships", key: "relationships", name: "Relationships" },
  spread: {
    id: "persona-obstacle-solution",
    key: "persona-obstacle-solution",
    name: "Persona, Obstacle, Solution",
    description: "A three-card spread for the dynamic, its friction, and a constructive direction.",
  },
  cards: [
    {
      readingCardId: "reading-card-persona",
      orientation: "reversed",
      position: { id: "position-persona", key: "persona", order: 0, name: "Persona", meaning: "How the relationship is showing up.", prompt: "What pattern is visible?" },
      card: { id: "ten-of-cups", nameEn: "Ten of Cups", nameVi: "Mười Cốc", arcana: "minor", suit: "cups", keywords: ["harmony", "belonging"] },
      knowledge: { upright: evidence("Ten of Cups upright"), reversed: evidence("Ten of Cups reversed") },
    },
    {
      readingCardId: "reading-card-obstacle",
      orientation: "reversed",
      position: { id: "position-obstacle", key: "obstacle", order: 1, name: "Obstacle", meaning: "What complicates the dynamic.", prompt: "What needs care?" },
      card: { id: "page-of-cups", nameEn: "Page of Cups", nameVi: "Tiểu Đồng Cốc", arcana: "minor", suit: "cups", keywords: ["feeling", "message"] },
      knowledge: { upright: evidence("Page of Cups upright"), reversed: evidence("Page of Cups reversed") },
    },
    {
      readingCardId: "reading-card-solution",
      orientation: "upright",
      position: { id: "position-solution", key: "solution", order: 2, name: "Solution", meaning: "A constructive direction to explore.", prompt: "What direction supports agency?" },
      card: { id: "the-chariot", nameEn: "The Chariot", nameVi: "Cỗ Xe", arcana: "major", suit: null, keywords: ["direction", "will"] },
      knowledge: { upright: evidence("The Chariot upright"), reversed: evidence("The Chariot reversed") },
    },
  ],
  retrievedGuidance: {
    method: ["Read the question and position before the card; synthesize the complete spread."],
    domain: ["Keep relationship readings behavioral and uncertainty-aware."],
    reversal: ["A reversal may be blocked, internalized, excessive, resisted, or changing."],
    synthesis: ["Use card relationships to form one thesis instead of a dictionary dump."],
    safety: ["Do not claim private thoughts or certain future events."],
  },
  combinationHints: [],
  fewShotExamples: [],
};

export const tarotReadingProviderOutputFixture: TarotProviderOutputV3 = {
  direct_answer: "First paragraph.\n\nSecond paragraph.",
  personal_insights: [{ title: "A pattern", body: "A useful pattern." }],
  reflection_prompts: ["What would you like to notice?"],
  next_steps: [{ title: "A next step", body: "Try one grounded action." }],
  card_evidence: tarotReadingQualityFixture.cards.map((card, index) => ({
    reading_card_id: card.readingCardId,
    position_key: card.position.key,
    interpretation: `Interpretation ${index + 1}.`,
  })),
  deeper_reading: null,
  follow_up_suggestions: ["Explore the pattern.", "Notice the next step."],
};

export const tarotReadingQualityAssertions = {
  cardCount: 3,
  cardIds: tarotReadingQualityFixture.cards.map((card) => card.readingCardId),
  positionKeys: tarotReadingQualityFixture.cards.map((card) => card.position.key),
} as const;
