import type {
  TarotCatalog,
  TarotCatalogCategory,
  TarotCatalogPosition,
  TarotCatalogTemplate,
  TarotLocale,
} from "./tarot-catalog";
import type { ReadingOwner } from "./tarot-guest";
import type { ReadingPayload } from "./tarot-interpretation";

export type CatalogCategoryRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  icon: string;
  imageUrl: string | null;
  displayOrder: number;
  active: boolean | number;
};

export type CatalogTemplateRow = {
  id: string;
  categoryId: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  cardCount: number;
  spreadType: string;
  displayOrder: number;
  active: boolean | number;
};

export type CatalogPositionRow = {
  id: string;
  templateId: string;
  key: string;
  order: number;
  labelEn: string;
  labelVi: string;
  descriptionEn: string;
  descriptionVi: string;
  promptEn: string;
  promptVi: string;
};

export type CatalogRows = {
  categories: CatalogCategoryRow[];
  templates: CatalogTemplateRow[];
  positions: CatalogPositionRow[];
};

export type TarotRepository = {
  listCatalog(locale: TarotLocale): Promise<TarotCatalog>;
  getActiveDeck(deckId: string): Promise<DeckRow | null>;
  getActiveTemplate(categoryId: string, templateId: string): Promise<ActiveTemplate | null>;
  getReadingTemplate(templateId: string, locale: TarotLocale): Promise<ReadingTemplateWithPositions | null>;
  listCards(deckId: string): Promise<CardRow[]>;
  createReadingSession(input: NewReadingSession): Promise<string>;
  createReadingCards(rows: NewReadingCard[]): Promise<void>;
  getSessionForOwner(sessionId: string, owner: ReadingOwner): Promise<ReadingSessionWithCards | null>;
  getMeaning(cardId: string, locale: TarotLocale, orientation: "upright" | "reversed"): Promise<CardMeaningRow | null>;
  getMeaningPair(cardId: string, locale: TarotLocale): Promise<{ upright: CardMeaningRow; reversed: CardMeaningRow } | null>;
  saveReading(input: NewReading): Promise<string>;
};

export type DeckRow = {
  id: string;
  slug: string;
  name: string;
  artist: string;
  description: string;
};

export type CardRow = {
  id: string;
  deckId: string;
  cardNumber: number;
  slug: string;
  nameEn: string;
  nameVi: string;
  arcana: string;
  suit: string;
  imageUrl: string;
};

export type CardMeaningRow = {
  id: string;
  cardId: string;
  locale: TarotLocale;
  orientation: "upright" | "reversed";
  summary: string;
  energy: string;
  actions: string;
  relationships: string;
  work: string;
  creativity: string;
  home: string;
  symbolism: string;
  journalQuestions: string[];
  keywords: string;
};

export type ActiveTemplate = {
  category: CatalogCategoryRow;
  template: CatalogTemplateRow;
  positions: CatalogPositionRow[];
};

export type ReadingSessionRow = ReadingSessionWithCards["session"];

export type ReadingCardWithDetails = ReadingSessionWithCards["cards"][number];

export type ReadingTemplateWithPositions = {
  category: {
    id: string;
    slug: string;
    name: string;
    description: string;
  };
  template: {
    id: string;
    categoryId: string;
    slug: string;
    name: string;
    description: string;
    cardCount: number;
    spreadType: string;
  };
  positions: Array<{
    id: string;
    key: string;
    order: number;
    name: string;
    meaning: string;
    prompt: string;
  }>;
};

export type NewReadingSession = {
  id: string;
  owner: ReadingOwner;
  question: string;
  optionalContext: string;
  categoryId: string;
  spreadTemplateId: string;
  spreadType: string;
  cardCount: number;
  locale: TarotLocale;
  status: string;
};

export type NewReadingCard = {
  id: string;
  sessionId: string;
  cardId: string;
  spreadPositionId: string;
  positionKey: string;
  positionOrder: number;
  positionLabel: string;
  orientation: string;
  cardOrder: number;
};

export type ReadingSessionWithCards = {
  session: {
    id: string;
    userId: string | null;
    guestId: string | null;
    question: string;
    optionalContext: string;
    categoryId: string;
    spreadTemplateId: string;
    spreadType: string;
    cardCount: number;
    locale: TarotLocale;
    status: string;
  };
  cards: Array<NewReadingCard & CardRow & { positionPrompt: string; positionDescription: string }>;
};

export type NewReading = {
  id: string;
  sessionId: string;
  reading: ReadingPayload;
  modelName: string;
  promptVersion: string;
};

function active(value: boolean | number): boolean {
  return value === true || value === 1;
}

function orderBy<T extends { displayOrder: number; id: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

function positionOrder<T extends { order: number; id: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export function mapCatalogRows(rows: CatalogRows, locale: TarotLocale): TarotCatalog {
  const categories = rows.categories.filter((category) => active(category.active));
  const templates = rows.templates.filter((template) => active(template.active));
  const positionsByTemplate = new Map<string, CatalogPositionRow[]>();
  for (const position of rows.positions) {
    const list = positionsByTemplate.get(position.templateId) || [];
    list.push(position);
    positionsByTemplate.set(position.templateId, list);
  }

  for (const template of templates) {
    const positions = positionsByTemplate.get(template.id) || [];
    if (positions.length !== template.cardCount) {
      throw new Error(`Spread ${template.slug} position count ${positions.length} does not match ${template.cardCount}`);
    }
  }

  const localized = (en: string, vi: string) => (locale === "vi" ? vi : en);
  const mappedTemplates = new Map<string, TarotCatalogTemplate>();
  for (const template of orderBy(templates)) {
    const templatePositions: TarotCatalogPosition[] = positionOrder(positionsByTemplate.get(template.id) || []).map((position) => ({
      ...position,
      label: localized(position.labelEn, position.labelVi),
      description: localized(position.descriptionEn, position.descriptionVi),
      prompt: localized(position.promptEn, position.promptVi),
    }));
    mappedTemplates.set(template.id, {
      ...template,
      active: true,
      name: localized(template.nameEn, template.nameVi),
      description: localized(template.descriptionEn, template.descriptionVi),
      positions: templatePositions,
    });
  }

  const mappedCategories: TarotCatalogCategory[] = orderBy(categories).map((category) => ({
    ...category,
    active: true,
    name: localized(category.nameEn, category.nameVi),
    description: localized(category.descriptionEn, category.descriptionVi),
    templates: orderBy(templates.filter((template) => template.categoryId === category.id))
      .map((template) => mappedTemplates.get(template.id))
      .filter((template): template is TarotCatalogTemplate => Boolean(template)),
  }));

  return { locale, categories: mappedCategories };
}

async function rows<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T[]> {
  const result = await database.prepare(statement).bind(...values).all();
  return result.results as unknown as T[];
}

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  const result = await database.prepare(statement).bind(...values).first();
  return (result as T | null) || null;
}

export function getTarotRepository(database: D1Database): TarotRepository {
  return {
    async listCatalog(locale) {
      const catalogRows: CatalogRows = {
        categories: await rows<CatalogCategoryRow>(database, "SELECT id, slug, name_en AS nameEn, name_vi AS nameVi, description_en AS descriptionEn, description_vi AS descriptionVi, icon, image_url AS imageUrl, display_order AS displayOrder, active FROM spread_categories WHERE active = 1 ORDER BY display_order, id"),
        templates: await rows<CatalogTemplateRow>(database, "SELECT id, category_id AS categoryId, slug, name_en AS nameEn, name_vi AS nameVi, description_en AS descriptionEn, description_vi AS descriptionVi, card_count AS cardCount, spread_type AS spreadType, display_order AS displayOrder, active FROM spread_templates WHERE active = 1 ORDER BY display_order, id"),
        positions: await rows<CatalogPositionRow>(database, "SELECT id, spread_template_id AS templateId, position_key AS key, position_order AS \"order\", label_en AS labelEn, label_vi AS labelVi, description_en AS descriptionEn, description_vi AS descriptionVi, prompt_en AS promptEn, prompt_vi AS promptVi FROM spread_positions ORDER BY spread_template_id, position_order, id"),
      };
      return mapCatalogRows(catalogRows, locale);
    },
    async getActiveDeck(deckId) {
      return first<DeckRow>(database, "SELECT id, slug, name, artist, description FROM decks WHERE id = ? AND active = 1", deckId);
    },
    async getActiveTemplate(categoryId, templateId) {
      const category = await first<CatalogCategoryRow>(database, "SELECT id, slug, name_en AS nameEn, name_vi AS nameVi, description_en AS descriptionEn, description_vi AS descriptionVi, icon, image_url AS imageUrl, display_order AS displayOrder, active FROM spread_categories WHERE id = ? AND active = 1", categoryId);
      const template = await first<CatalogTemplateRow>(database, "SELECT id, category_id AS categoryId, slug, name_en AS nameEn, name_vi AS nameVi, description_en AS descriptionEn, description_vi AS descriptionVi, card_count AS cardCount, spread_type AS spreadType, display_order AS displayOrder, active FROM spread_templates WHERE id = ? AND category_id = ? AND active = 1", templateId, categoryId);
      if (!category || !template) return null;
      const positions = await rows<CatalogPositionRow>(database, "SELECT id, spread_template_id AS templateId, position_key AS key, position_order AS \"order\", label_en AS labelEn, label_vi AS labelVi, description_en AS descriptionEn, description_vi AS descriptionVi, prompt_en AS promptEn, prompt_vi AS promptVi FROM spread_positions WHERE spread_template_id = ? ORDER BY position_order, id", templateId);
      return { category, template, positions };
    },
    async getReadingTemplate(templateId, locale) {
      const category = await first<CatalogCategoryRow>(database, "SELECT c.id, c.slug, c.name_en AS nameEn, c.name_vi AS nameVi, c.description_en AS descriptionEn, c.description_vi AS descriptionVi, c.icon, c.image_url AS imageUrl, c.display_order AS displayOrder, c.active FROM spread_categories c JOIN spread_templates t ON t.category_id = c.id WHERE t.id = ?", templateId);
      const template = await first<CatalogTemplateRow>(database, "SELECT id, category_id AS categoryId, slug, name_en AS nameEn, name_vi AS nameVi, description_en AS descriptionEn, description_vi AS descriptionVi, card_count AS cardCount, spread_type AS spreadType, display_order AS displayOrder, active FROM spread_templates WHERE id = ?", templateId);
      if (!category || !template || category.id !== template.categoryId) return null;
      const positionRows = await rows<CatalogPositionRow>(database, "SELECT id, spread_template_id AS templateId, position_key AS key, position_order AS \"order\", label_en AS labelEn, label_vi AS labelVi, description_en AS descriptionEn, description_vi AS descriptionVi, prompt_en AS promptEn, prompt_vi AS promptVi FROM spread_positions WHERE spread_template_id = ? ORDER BY position_order, id", templateId);
      const localized = (en: string, vi: string) => locale === "vi" ? vi : en;
      return {
        category: {
          id: category.id,
          slug: category.slug,
          name: localized(category.nameEn, category.nameVi),
          description: localized(category.descriptionEn, category.descriptionVi),
        },
        template: {
          id: template.id,
          categoryId: template.categoryId,
          slug: template.slug,
          name: localized(template.nameEn, template.nameVi),
          description: localized(template.descriptionEn, template.descriptionVi),
          cardCount: template.cardCount,
          spreadType: template.spreadType,
        },
        positions: positionOrder(positionRows).map((position) => ({
          id: position.id,
          key: position.key,
          order: position.order,
          name: localized(position.labelEn, position.labelVi),
          meaning: localized(position.descriptionEn, position.descriptionVi),
          prompt: localized(position.promptEn, position.promptVi),
        })),
      };
    },
    async listCards(deckId) {
      return rows<CardRow>(database, "SELECT id, deck_id AS deckId, card_number AS cardNumber, slug, name_en AS nameEn, name_vi AS nameVi, arcana, suit, image_url AS imageUrl FROM tarot_cards WHERE deck_id = ? ORDER BY display_order, id", deckId);
    },
    async createReadingSession(input) {
      const now = Date.now();
      await database.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(input.id, input.owner.kind === "user" ? input.owner.userId : null, input.owner.kind === "guest" ? input.owner.guestId : null, input.question, input.optionalContext, input.categoryId, input.spreadTemplateId, input.spreadType, input.cardCount, input.locale, input.status, now, now)
        .run();
      return input.id;
    },
    async createReadingCards(readingCards) {
      if (!readingCards.length) return;
      const now = Date.now();
      await database.batch(readingCards.map((card) => database.prepare("INSERT INTO reading_cards (id, session_id, card_id, spread_position_id, position_key, position_order, position_label, orientation, card_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(card.id, card.sessionId, card.cardId, card.spreadPositionId, card.positionKey, card.positionOrder, card.positionLabel, card.orientation, card.cardOrder, now)));
    },
    async getSessionForOwner(sessionId, owner) {
      const ownerColumn = owner.kind === "user" ? "s.user_id" : "s.guest_id";
      const session = await first<ReadingSessionWithCards["session"]>(database, `SELECT s.id, s.user_id AS userId, s.guest_id AS guestId, s.question, s.optional_context AS optionalContext, s.category_id AS categoryId, s.spread_template_id AS spreadTemplateId, s.spread_type AS spreadType, s.card_count AS cardCount, s.locale, s.status FROM reading_sessions s WHERE s.id = ? AND ${ownerColumn} = ?`, sessionId, owner.kind === "user" ? owner.userId : owner.guestId);
      if (!session) return null;
      const cardRows = await rows<NewReadingCard & CardRow & { promptEn: string; promptVi: string; descriptionEn: string; descriptionVi: string }>(database, "SELECT rc.id, rc.session_id AS sessionId, rc.card_id AS cardId, rc.spread_position_id AS spreadPositionId, rc.position_key AS positionKey, rc.position_order AS positionOrder, rc.position_label AS positionLabel, rc.orientation, rc.card_order AS cardOrder, tc.deck_id AS deckId, tc.card_number AS cardNumber, tc.slug, tc.name_en AS nameEn, tc.name_vi AS nameVi, tc.arcana, tc.suit, tc.image_url AS imageUrl, sp.prompt_en AS promptEn, sp.prompt_vi AS promptVi, sp.description_en AS descriptionEn, sp.description_vi AS descriptionVi FROM reading_cards rc JOIN tarot_cards tc ON tc.id = rc.card_id JOIN spread_positions sp ON sp.id = rc.spread_position_id WHERE rc.session_id = ? ORDER BY rc.card_order, rc.id", sessionId);
      const cards = cardRows.map(({ promptEn, promptVi, descriptionEn, descriptionVi, ...card }) => ({ ...card, positionPrompt: session.locale === "vi" ? promptVi : promptEn, positionDescription: session.locale === "vi" ? descriptionVi : descriptionEn }));
      return { session, cards };
    },
    async getMeaning(cardId, locale, orientation) {
      const row = await first<Omit<CardMeaningRow, "journalQuestions"> & { journalQuestions: string }>(database, "SELECT id, card_id AS cardId, locale, orientation, summary, energy, actions, relationships, work, creativity, home, symbolism, journal_questions AS journalQuestions, keywords FROM card_meanings WHERE card_id = ? AND locale = ? AND orientation = ?", cardId, locale, orientation);
      if (!row) return null;
      let journalQuestions: string[] = [];
      try {
        const value = JSON.parse(row.journalQuestions);
        if (Array.isArray(value)) journalQuestions = value.filter((item): item is string => typeof item === "string").slice(0, 10);
      } catch {
        journalQuestions = [];
      }
      return { ...row, journalQuestions };
    },
    async getMeaningPair(cardId, locale) {
      const meaningRows = await rows<Omit<CardMeaningRow, "journalQuestions"> & { journalQuestions: string }>(database, "SELECT cm.id, cm.card_id AS cardId, cm.locale, cm.orientation, cm.summary, cm.energy, cm.actions, cm.relationships, cm.work, cm.creativity, cm.home, cm.symbolism, cm.journal_questions AS journalQuestions, cm.keywords FROM card_meanings cm JOIN tarot_cards tc ON tc.id = cm.card_id JOIN decks d ON d.id = tc.deck_id WHERE cm.card_id = ? AND cm.locale = ? AND d.active = 1 AND cm.orientation IN ('upright', 'reversed') ORDER BY CASE cm.orientation WHEN 'upright' THEN 0 ELSE 1 END", cardId, locale);
      const parsed = new Map<string, CardMeaningRow>();
      for (const row of meaningRows) {
        let journalQuestions: string[] = [];
        try {
          const value = JSON.parse(row.journalQuestions);
          if (Array.isArray(value)) journalQuestions = value.filter((item): item is string => typeof item === "string");
        } catch {
          journalQuestions = [];
        }
        parsed.set(row.orientation, { ...row, journalQuestions });
      }
      const upright = parsed.get("upright");
      const reversed = parsed.get("reversed");
      return upright && reversed ? { upright, reversed } : null;
    },
    async saveReading(input) {
      const now = Date.now();
      const synthesis = input.reading.personalInsights.map(({ title, body }) => `${title}: ${body}`).join("\n\n");
      const advice = input.reading.nextSteps.map(({ title, body }) => `${title}: ${body}`).join("\n\n");
      const closing = input.reading.deeperReading || input.reading.directAnswer;
      await database.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(input.id, input.sessionId, input.reading.directAnswer, JSON.stringify(input.reading.cardEvidence), synthesis, advice, closing, input.reading.disclaimer, input.modelName, input.promptVersion, now, now)
        .run();
      return input.id;
    },
  };
}
