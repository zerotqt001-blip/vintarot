import { sql } from "drizzle-orm";
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

export const readingShares = sqliteTable(
  "reading_shares",
  {
    id: text("id").primaryKey(),
    readingId: text("reading_id").notNull().references(() => readings.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("active"),
    locale: text("locale").notNull(),
    publicContractVersion: text("public_contract_version").notNull(),
    geometryVersion: text("geometry_version").notNull(),
    rendererVersion: text("renderer_version").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    revokedAt: integer("revoked_at"),
    expiresAt: integer("expires_at"),
  },
  (table) => [
    uniqueIndex("reading_shares_token_hash_unique").on(table.tokenHash),
    uniqueIndex("reading_shares_active_reading_unique").on(table.readingId).where(sql`${table.status} = 'active'`),
    index("reading_shares_reading_status_idx").on(table.readingId, table.status),
    index("reading_shares_expires_idx").on(table.status, table.expiresAt),
  ],
);

export const shareEvents = sqliteTable(
  "share_events",
  {
    id: text("id").primaryKey(),
    shareId: text("share_id").notNull().references(() => readingShares.id, { onDelete: "cascade" }),
    eventName: text("event_name").notNull(),
    locale: text("locale").notNull(),
    source: text("source"),
    rendererVersion: text("renderer_version"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("share_events_share_created_idx").on(table.shareId, table.createdAt)],
);

export const creditAccounts = sqliteTable(
  "credit_accounts",
  {
    id: text("id").primaryKey(),
    ownerKind: text("owner_kind").notNull(),
    ownerId: text("owner_id").notNull(),
    mutationVersion: integer("mutation_version").notNull().default(0),
    mutationToken: text("mutation_token"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("credit_accounts_owner_unique").on(table.ownerKind, table.ownerId),
    index("credit_accounts_mutation_idx").on(table.mutationVersion, table.updatedAt),
  ],
);

export const packages = sqliteTable(
  "packages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameVi: text("name_vi").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("packages_slug_unique").on(table.slug),
    index("packages_active_idx").on(table.active, table.slug),
  ],
);

export const packageVersions = sqliteTable(
  "package_versions",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id").notNull().references(() => packages.id),
    version: integer("version").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    creditUnits: integer("credit_units").notNull(),
    vipDurationSeconds: integer("vip_duration_seconds"),
    benefitSnapshot: text("benefit_snapshot").notNull(),
    policyVersion: text("policy_version").notNull(),
    status: text("status").notNull().default("active"),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("package_versions_package_version_unique").on(table.packageId, table.version),
    index("package_versions_catalog_idx").on(table.status, table.startsAt, table.endsAt),
  ],
);

export const creditGrants = sqliteTable(
  "credit_grants",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => creditAccounts.id),
    source: text("source").notNull(),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    grantKey: text("grant_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    units: integer("units").notNull(),
    availableUnits: integer("available_units").notNull(),
    eligibleFrom: integer("eligible_from").notNull(),
    expiresAt: integer("expires_at"),
    policyVersion: text("policy_version").notNull(),
    policySnapshot: text("policy_snapshot").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("credit_grants_account_key_unique").on(table.accountId, table.grantKey),
    index("credit_grants_eligible_idx").on(table.accountId, table.eligibleFrom, table.expiresAt, table.createdAt),
    index("credit_grants_source_idx").on(table.source, table.sourceType, table.sourceId),
  ],
);

export const creditLedger = sqliteTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => creditAccounts.id),
    grantId: text("grant_id").references(() => creditGrants.id),
    reservationId: text("reservation_id"),
    eventType: text("event_type").notNull(),
    units: integer("units").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    actorKind: text("actor_kind"),
    actorId: text("actor_id"),
    reason: text("reason").notNull(),
    effectiveAt: integer("effective_at").notNull(),
    createdAt: integer("created_at").notNull(),
    reversedEntryId: text("reversed_entry_id"),
  },
  (table) => [
    uniqueIndex("credit_ledger_account_key_unique").on(table.accountId, table.idempotencyKey),
    index("credit_ledger_account_created_idx").on(table.accountId, table.createdAt, table.id),
    index("credit_ledger_grant_idx").on(table.grantId, table.createdAt),
    index("credit_ledger_reference_idx").on(table.referenceType, table.referenceId),
  ],
);

export const creditReservations = sqliteTable(
  "credit_reservations",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => creditAccounts.id),
    usageType: text("usage_type").notNull(),
    units: integer("units").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    status: text("status").notNull().default("PENDING"),
    leaseExpiresAt: integer("lease_expires_at"),
    retryCount: integer("retry_count").notNull().default(0),
    resultType: text("result_type"),
    resultId: text("result_id"),
    reason: text("reason"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    consumedAt: integer("consumed_at"),
    releasedAt: integer("released_at"),
  },
  (table) => [
    uniqueIndex("credit_reservations_owner_key_unique").on(table.accountId, table.idempotencyKey),
    index("credit_reservations_owner_status_idx").on(table.accountId, table.status, table.updatedAt),
    index("credit_reservations_lease_idx").on(table.status, table.leaseExpiresAt),
  ],
);

export const creditReservationAllocations = sqliteTable(
  "credit_reservation_allocations",
  {
    id: text("id").primaryKey(),
    reservationId: text("reservation_id").notNull().references(() => creditReservations.id, { onDelete: "cascade" }),
    grantId: text("grant_id").notNull().references(() => creditGrants.id),
    heldUnits: integer("held_units").notNull(),
    consumedUnits: integer("consumed_units").notNull().default(0),
    releasedUnits: integer("released_units").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("credit_reservation_allocations_reservation_grant_unique").on(table.reservationId, table.grantId),
    index("credit_reservation_allocations_grant_idx").on(table.grantId, table.reservationId),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => creditAccounts.id),
    packageId: text("package_id").notNull().references(() => packages.id),
    packageVersionId: text("package_version_id").notNull().references(() => packageVersions.id),
    packageSnapshot: text("package_snapshot").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    paymentReference: text("payment_reference"),
    createdAt: integer("created_at").notNull(),
    paymentConfirmedAt: integer("payment_confirmed_at"),
    fulfilledAt: integer("fulfilled_at"),
    cancelledAt: integer("cancelled_at"),
    refundedAt: integer("refunded_at"),
  },
  (table) => [
    uniqueIndex("orders_account_key_unique").on(table.accountId, table.idempotencyKey),
    uniqueIndex("orders_payment_reference_unique").on(table.paymentReference),
    index("orders_account_status_idx").on(table.accountId, table.status, table.createdAt),
    index("orders_package_idx").on(table.packageId, table.packageVersionId),
  ],
);

export const entitlements = sqliteTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => creditAccounts.id),
    entitlementType: text("entitlement_type").notNull(),
    benefitVersion: text("benefit_version").notNull(),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at"),
    status: text("status").notNull().default("ACTIVE"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    grantKey: text("grant_key").notNull(),
    benefitSnapshot: text("benefit_snapshot").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    cancelledAt: integer("cancelled_at"),
  },
  (table) => [
    uniqueIndex("entitlements_account_key_unique").on(table.accountId, table.grantKey),
    index("entitlements_account_status_idx").on(table.accountId, table.entitlementType, table.status, table.endsAt),
    index("entitlements_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const orderFulfillments = sqliteTable(
  "order_fulfillments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id),
    fulfillmentKey: text("fulfillment_key").notNull(),
    resultSnapshot: text("result_snapshot").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("order_fulfillments_order_unique").on(table.orderId),
    uniqueIndex("order_fulfillments_key_unique").on(table.fulfillmentKey),
  ],
);

export const commercialEvents = sqliteTable(
  "commercial_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: text("payload").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("commercial_events_key_unique").on(table.idempotencyKey),
    index("commercial_events_aggregate_idx").on(table.aggregateType, table.aggregateId, table.createdAt),
  ],
);
