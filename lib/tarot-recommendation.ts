import {
  currentSpreadCatalog,
  type TarotCategorySeed,
  type TarotPositionSeed,
  type TarotTemplateSeed,
} from "./tarot-catalog";

export const tarotTopics = ["work", "relationships", "changes", "creativity", "magic", "idk"] as const;
export type TarotTopic = (typeof tarotTopics)[number];
export type TarotSpreadSelectionMode = "auto" | "manual";
export type TarotRecommendationIntent =
  | "GENERAL"
  | "RELATIONSHIP"
  | "DECISION"
  | "OBSTACLE"
  | "DIRECTION"
  | "SELF_REFLECTION"
  | "CAREER"
  | "FINANCE";
export type TarotRecommendationReasonKey =
  | "relationship"
  | "career"
  | "finance"
  | "creativity"
  | "change"
  | "direction"
  | "selfReflection"
  | "decision"
  | "obstacle"
  | "general";

export type TarotRecommendation = {
  mode: "auto";
  detectedTopic: TarotTopic;
  intent: TarotRecommendationIntent;
  recommendedSpreadId: string;
  categoryId: string;
  confidence: "high" | "medium" | "low";
  reasonKey: TarotRecommendationReasonKey;
};

export type CanonicalTarotSpread = {
  category: TarotCategorySeed;
  template: TarotTemplateSeed;
  positions: TarotPositionSeed[];
};

type SpreadTarget = {
  categorySlug: string;
  spreadSlug: string;
  reasonKey: TarotRecommendationReasonKey;
};

type SignalGroup = {
  topic: TarotTopic;
  phrases: readonly string[];
};

const topicDefaults: Record<TarotTopic, SpreadTarget> = {
  work: { categorySlug: "business", spreadSlug: "finding-your-magic", reasonKey: "career" },
  relationships: { categorySlug: "relationships", spreadSlug: "relationship-check-in", reasonKey: "relationship" },
  changes: { categorySlug: "fools-journey", spreadSlug: "between-worlds", reasonKey: "change" },
  creativity: { categorySlug: "creativity", spreadSlug: "seed-sprout-harvest", reasonKey: "creativity" },
  magic: { categorySlug: "self-care", spreadSlug: "mind-body-spirit", reasonKey: "selfReflection" },
  idk: { categorySlug: "everyday", spreadSlug: "persona-obstacle-solution", reasonKey: "general" },
};

const signalGroups: readonly SignalGroup[] = [
  {
    topic: "relationships",
    phrases: [
      "relationship",
      "love",
      "partner",
      "connection",
      "dating",
      "ex",
      "feelings",
      "romance",
      "nguoi ay",
      "tinh cam",
      "tinh yeu",
      "moi quan he",
      "hen ho",
      "ket noi",
      "chia tay",
      "cam xuc",
    ],
  },
  {
    topic: "work",
    phrases: [
      "career",
      "job",
      "work",
      "opportunity",
      "boss",
      "colleague",
      "project",
      "business",
      "promotion",
      "su nghiep",
      "cong viec",
      "viec lam",
      "co hoi",
      "sep",
      "dong nghiep",
      "du an",
      "kinh doanh",
    ],
  },
  {
    topic: "work",
    phrases: [
      "money",
      "finance",
      "financial",
      "debt",
      "salary",
      "income",
      "investment",
      "budget",
      "tien",
      "tai chinh",
      "no",
      "luong",
      "thu nhap",
      "dau tu",
      "ngan sach",
    ],
  },
  {
    topic: "creativity",
    phrases: [
      "creative",
      "creativity",
      "art",
      "write",
      "writing",
      "music",
      "design",
      "create",
      "sang tao",
      "nghe thuat",
      "viet",
      "am nhac",
      "thiet ke",
      "tao ra",
    ],
  },
  {
    topic: "changes",
    phrases: [
      "change",
      "transition",
      "move",
      "moving",
      "new chapter",
      "release",
      "let go",
      "reset",
      "thay doi",
      "chuyen minh",
      "buoc ngoat",
      "buong bo",
      "bat dau lai",
    ],
  },
  {
    topic: "magic",
    phrases: [
      "myself",
      "intuition",
      "healing",
      "confidence",
      "growth",
      "purpose",
      "identity",
      "inner",
      "ban than",
      "truc giac",
      "chua lanh",
      "tu tin",
      "truong thanh",
      "muc dich",
      "noi tam",
    ],
  },
];

const decisionPhrases = [
  "should i",
  "should we",
  "do i",
  "which",
  "choose",
  "decide",
  "decision",
  "stay or go",
  "co nen",
  "nen ",
  "chon",
  "quyet dinh",
  "o lai hay di",
];
const obstaclePhrases = [
  "blocked",
  "blocking",
  "block ",
  "stuck",
  "problem",
  "challenge",
  "obstacle",
  "difficult",
  "bế tắc",
  "be tac",
  "bi chan",
  "dang chan",
  "kho khan",
  "tro ngai",
  "van de",
  "vuong mac",
];
const directionPhrases = [
  "next",
  "future",
  "where do i",
  "what now",
  "how can i",
  "how should i",
  "direction",
  "tiep theo",
  "tuong lai",
  "huong nao",
  "lam sao",
  "buoc tiep",
];
const relationshipUncertaintyPhrases = [
  "feel",
  "feelings",
  "still love",
  "what does",
  "unclear",
  "tinh cam",
  "con yeu",
  "cam xuc",
  "nguoi ay",
];
const financePhrases = signalGroups[2].phrases;

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(value: string, phrases: readonly string[]): boolean {
  const paddedValue = ` ${value} `;
  return phrases.some((phrase) => {
    const normalizedPhrase = normalizeQuestion(phrase);
    return Boolean(normalizedPhrase) && paddedValue.includes(` ${normalizedPhrase} `);
  });
}

function countMatches(value: string, phrases: readonly string[]): number {
  const paddedValue = ` ${value} `;
  return phrases.reduce((total, phrase) => {
    const normalizedPhrase = normalizeQuestion(phrase);
    return total + (normalizedPhrase && paddedValue.includes(` ${normalizedPhrase} `) ? 1 : 0);
  }, 0);
}

function topicScore(value: string, topic: TarotTopic): number {
  return signalGroups
    .filter((group) => group.topic === topic)
    .reduce((total, group) => total + countMatches(value, group.phrases), 0);
}

function detectedTopic(value: string, explicitTopic?: TarotTopic | null): { topic: TarotTopic; score: number } {
  if (explicitTopic && tarotTopics.includes(explicitTopic)) return { topic: explicitTopic, score: 3 };

  const scores = tarotTopics.map((topic) => ({ topic, score: topicScore(value, topic) }));
  return scores.reduce((best, candidate) => candidate.score > best.score ? candidate : best, { topic: "idk" as TarotTopic, score: 0 });
}

function classifyIntent(value: string, topic: TarotTopic): TarotRecommendationIntent {
  const isDecision = matchesAny(value, decisionPhrases);
  const isObstacle = matchesAny(value, obstaclePhrases);
  const isDirection = matchesAny(value, directionPhrases);
  const isFinance = matchesAny(value, financePhrases);

  if (topic === "work" && isFinance) return "FINANCE";
  if (topic === "work" && topicScore(value, "work") > 0 && (isDecision || isDirection)) return "CAREER";
  if (topic === "relationships") return isDecision ? "DECISION" : "RELATIONSHIP";
  if (topic === "creativity" && isObstacle) return "OBSTACLE";
  if (isObstacle) return "OBSTACLE";
  if (isDecision) return "DECISION";
  if (isDirection) return "DIRECTION";
  if (topic === "magic") return "SELF_REFLECTION";
  if (topic === "work" && topicScore(value, "work") > 0) return "CAREER";
  return topic === "idk" ? "GENERAL" : "DIRECTION";
}

function targetFor(topic: TarotTopic, intent: TarotRecommendationIntent, value: string): SpreadTarget {
  if (topic === "relationships") {
    if (matchesAny(value, relationshipUncertaintyPhrases)) {
      return { categorySlug: "relationships", spreadSlug: "unclear-feelings", reasonKey: "relationship" };
    }
    if (intent === "DECISION") return { categorySlug: "relationships", spreadSlug: "act-or-wait", reasonKey: "decision" };
    if (intent === "OBSTACLE") return { categorySlug: "relationships", spreadSlug: "conflict-resolution", reasonKey: "obstacle" };
  }

  if (topic === "work") {
    if (intent === "FINANCE") return { categorySlug: "business", spreadSlug: "strategic-overview-swot", reasonKey: "finance" };
    if (intent === "CAREER") return { categorySlug: "planning", spreadSlug: "career-crossroads", reasonKey: "career" };
  }

  if (topic === "creativity") {
    if (intent === "OBSTACLE") return { categorySlug: "creativity", spreadSlug: "getting-unstuck", reasonKey: "obstacle" };
    if (intent === "DIRECTION") return { categorySlug: "creativity", spreadSlug: "creative-direction", reasonKey: "direction" };
  }

  if (topic === "idk") {
    if (intent === "DECISION") return { categorySlug: "planning", spreadSlug: "yes-or-no", reasonKey: "decision" };
    if (intent === "OBSTACLE") return { categorySlug: "everyday", spreadSlug: "how-to-handle-it", reasonKey: "obstacle" };
    if (intent === "DIRECTION") return { categorySlug: "planning", spreadSlug: "past-present-future", reasonKey: "direction" };
  }

  return topicDefaults[topic];
}

function findBySlugs(categorySlug: string, spreadSlug: string): CanonicalTarotSpread | null {
  const category = currentSpreadCatalog.categories.find((item) => item.slug === categorySlug && item.active);
  const template = currentSpreadCatalog.templates.find((item) => item.slug === spreadSlug && item.categoryId === category?.id && item.active);
  if (!category || !template) return null;
  const positions = currentSpreadCatalog.positions
    .filter((position) => position.templateId === template.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  if (template.cardCount !== positions.length) return null;
  return { category, template, positions };
}

export function findCanonicalSpread(categoryId: string, templateId: string): CanonicalTarotSpread | null {
  const category = currentSpreadCatalog.categories.find((item) => item.id === categoryId && item.active);
  const template = currentSpreadCatalog.templates.find((item) => item.id === templateId && item.categoryId === categoryId && item.active);
  if (!category || !template) return null;
  const positions = currentSpreadCatalog.positions
    .filter((position) => position.templateId === template.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  if (template.cardCount !== positions.length) return null;
  return { category, template, positions };
}

export function recommendTarotSpread(question: string, explicitTopic?: TarotTopic | null): TarotRecommendation {
  const normalized = normalizeQuestion(typeof question === "string" ? question : "");
  const detected = detectedTopic(normalized, explicitTopic);
  const intent = classifyIntent(normalized, detected.topic);
  const requested = targetFor(detected.topic, intent, normalized);
  const fallback = topicDefaults.idk;
  const resolved = findBySlugs(requested.categorySlug, requested.spreadSlug) || findBySlugs(fallback.categorySlug, fallback.spreadSlug);
  if (!resolved) throw new Error("The canonical everyday spread is unavailable.");

  const intentSignal = matchesAny(normalized, [...decisionPhrases, ...obstaclePhrases, ...directionPhrases, ...financePhrases]);
  const confidence = explicitTopic || detected.score >= 2 || (detected.score > 0 && intentSignal)
    ? "high"
    : detected.score === 1
      ? "medium"
      : "low";
  return {
    mode: "auto",
    detectedTopic: detected.topic,
    intent,
    recommendedSpreadId: resolved.template.id,
    categoryId: resolved.category.id,
    confidence,
    reasonKey: requested === fallback && detected.topic !== "idk" ? topicDefaults[detected.topic].reasonKey : requested.reasonKey,
  };
}
