import { integer, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    kind: text("kind").notNull(),
    data: text("data").notNull(),
    created: integer("created").notNull(),
    updated: integer("updated").notNull(),
  },
  (table) => [index("idx_records_owner_kind").on(table.owner, table.kind)],
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    state: text("state").notNull(),
    revision: integer("revision").notNull().default(0),
    invite: text("invite").notNull(),
    created: integer("created").notNull(),
    updated: integer("updated").notNull(),
  },
  (table) => [index("idx_rooms_owner").on(table.owner), uniqueIndex("idx_rooms_invite").on(table.invite)],
);

export const members = sqliteTable(
  "room_members",
  {
    id: text("id").primaryKey(),
    room: text("room").notNull(),
    user: text("user").notNull(),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("idx_members_room_user").on(table.room, table.user)],
);

export const decks = sqliteTable(
  "decks",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    artist: text("artist").notNull(),
    description: text("description").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_decks_slug").on(table.slug), index("idx_decks_active").on(table.active)],
);

export const tarotCards = sqliteTable(
  "tarot_cards",
  {
    id: text("id").primaryKey(),
    deckId: text("deck_id").notNull().references(() => decks.id),
    cardNumber: integer("card_number").notNull(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameVi: text("name_vi").notNull(),
    arcana: text("arcana").notNull(),
    suit: text("suit").notNull(),
    imageUrl: text("image_url").notNull(),
    displayOrder: integer("display_order").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_tarot_cards_deck_number").on(table.deckId, table.cardNumber),
    uniqueIndex("idx_tarot_cards_deck_slug").on(table.deckId, table.slug),
    uniqueIndex("idx_tarot_cards_deck_order").on(table.deckId, table.displayOrder),
    index("idx_tarot_cards_deck").on(table.deckId),
  ],
);

export const cardMeanings = sqliteTable(
  "card_meanings",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull().references(() => tarotCards.id),
    locale: text("locale").notNull(),
    orientation: text("orientation").notNull(),
    summary: text("summary").notNull(),
    energy: text("energy").notNull(),
    actions: text("actions").notNull(),
    relationships: text("relationships").notNull(),
    work: text("work").notNull(),
    creativity: text("creativity").notNull(),
    home: text("home").notNull(),
    symbolism: text("symbolism").notNull(),
    journalQuestions: text("journal_questions").notNull(),
    keywords: text("keywords").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_card_meanings_variant").on(table.cardId, table.locale, table.orientation),
    index("idx_card_meanings_card_locale").on(table.cardId, table.locale),
  ],
);

export const spreadCategories = sqliteTable(
  "spread_categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameVi: text("name_vi").notNull(),
    descriptionEn: text("description_en").notNull(),
    descriptionVi: text("description_vi").notNull(),
    icon: text("icon").notNull(),
    imageUrl: text("image_url"),
    displayOrder: integer("display_order").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_spread_categories_slug").on(table.slug), index("idx_spread_categories_active_order").on(table.active, table.displayOrder)],
);

export const spreadTemplates = sqliteTable(
  "spread_templates",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").notNull().references(() => spreadCategories.id),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameVi: text("name_vi").notNull(),
    descriptionEn: text("description_en").notNull(),
    descriptionVi: text("description_vi").notNull(),
    cardCount: integer("card_count").notNull(),
    spreadType: text("spread_type").notNull(),
    displayOrder: integer("display_order").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_spread_templates_category_slug").on(table.categoryId, table.slug),
    index("idx_spread_templates_category_order").on(table.categoryId, table.active, table.displayOrder),
  ],
);

export const spreadPositions = sqliteTable(
  "spread_positions",
  {
    id: text("id").primaryKey(),
    spreadTemplateId: text("spread_template_id").notNull().references(() => spreadTemplates.id),
    positionKey: text("position_key").notNull(),
    positionOrder: integer("position_order").notNull(),
    labelEn: text("label_en").notNull(),
    labelVi: text("label_vi").notNull(),
    descriptionEn: text("description_en").notNull(),
    descriptionVi: text("description_vi").notNull(),
    promptEn: text("prompt_en").notNull(),
    promptVi: text("prompt_vi").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_spread_positions_template_key").on(table.spreadTemplateId, table.positionKey),
    uniqueIndex("idx_spread_positions_template_order").on(table.spreadTemplateId, table.positionOrder),
  ],
);

export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    guestId: text("guest_id"),
    question: text("question").notNull(),
    optionalContext: text("optional_context").notNull().default(""),
    categoryId: text("category_id").notNull().references(() => spreadCategories.id),
    spreadTemplateId: text("spread_template_id").notNull().references(() => spreadTemplates.id),
    spreadType: text("spread_type").notNull(),
    cardCount: integer("card_count").notNull(),
    locale: text("locale").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_reading_sessions_user_created").on(table.userId, table.createdAt),
    index("idx_reading_sessions_guest_created").on(table.guestId, table.createdAt),
  ],
);

export const readingCards = sqliteTable(
  "reading_cards",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => readingSessions.id),
    cardId: text("card_id").notNull().references(() => tarotCards.id),
    spreadPositionId: text("spread_position_id").notNull().references(() => spreadPositions.id),
    positionKey: text("position_key").notNull(),
    positionOrder: integer("position_order").notNull(),
    positionLabel: text("position_label").notNull(),
    orientation: text("orientation").notNull(),
    cardOrder: integer("card_order").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_reading_cards_session_order").on(table.sessionId, table.cardOrder),
    uniqueIndex("idx_reading_cards_session_position").on(table.sessionId, table.spreadPositionId),
    index("idx_reading_cards_session").on(table.sessionId),
  ],
);

export const readings = sqliteTable(
  "readings",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => readingSessions.id),
    opening: text("opening").notNull(),
    cardReadings: text("card_readings").notNull(),
    synthesis: text("synthesis").notNull(),
    advice: text("advice").notNull(),
    closing: text("closing").notNull(),
    disclaimer: text("disclaimer").notNull(),
    readingPayload: text("reading_payload"),
    modelName: text("model_name").notNull(),
    promptVersion: text("prompt_version").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_readings_session").on(table.sessionId)],
);
