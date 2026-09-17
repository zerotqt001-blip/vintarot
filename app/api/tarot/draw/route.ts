import { boundary, db, json, originCheck } from "@/lib/server";
import { getTarotRepository } from "@/lib/tarot-repository";
import { drawRequestSchema, makeDrawPlan, makeSelectedDrawPlan } from "@/lib/tarot-draw";
import { readOptionalOwner } from "@/lib/tarot-guest";

export async function POST(req: Request) {
  return boundary(async () => {
    originCheck(req);
    const validation = drawRequestSchema.safeParse(await json(req));
    if (!validation.success) return Response.json({ error: "Invalid Tarot draw request." }, { status: 400 });
    const parsed = validation.data;
    const { owner, setCookie } = await readOptionalOwner(req);
    const repository = getTarotRepository(db());
    const [deck, activeTemplate] = await Promise.all([
      repository.getActiveDeck(parsed.deck_id),
      repository.getActiveTemplate(parsed.category_id, parsed.spread_template_id),
    ]);
    if (!deck) return Response.json({ error: "Deck not found." }, { status: 404 });
    if (!activeTemplate) return Response.json({ error: "Spread not found for this category." }, { status: 404 });
    if (activeTemplate.positions.length !== activeTemplate.template.cardCount) {
      return Response.json({ error: "Spread position count is invalid." }, { status: 409 });
    }

    const positions = activeTemplate.positions.map((position) => ({
      id: position.id,
      key: position.key,
      order: position.order,
      label: parsed.locale === "vi" ? position.labelVi : position.labelEn,
    }));
    const cards = await repository.listCards(parsed.deck_id);
    let plan;
    try {
      plan = parsed.selected_cards
        ? makeSelectedDrawPlan({
            cards,
            positions,
            reversals: parsed.reversals,
            selections: parsed.selected_cards.map((selection) => ({ cardNumber: selection.card_number, orientation: selection.orientation })),
          })
        : makeDrawPlan({ cards, positions, reversals: parsed.reversals });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Selected cards are invalid." }, { status: 400 });
    }
    const sessionId = globalThis.crypto.randomUUID();
    await repository.createReadingSession({
      id: sessionId,
      owner,
      question: parsed.question,
      optionalContext: parsed.optional_context,
      categoryId: parsed.category_id,
      spreadTemplateId: parsed.spread_template_id,
      spreadType: activeTemplate.template.spreadType,
      cardCount: activeTemplate.template.cardCount,
      locale: parsed.locale,
      status: "drawn",
    });
    await repository.createReadingCards(plan.map((card) => ({
      id: card.readingCardId,
      sessionId,
      cardId: card.cardId,
      spreadPositionId: card.positionId,
      positionKey: card.positionKey,
      positionOrder: card.positionOrder,
      positionLabel: card.positionLabel,
      orientation: card.orientation,
      cardOrder: card.positionOrder,
    })));

    const cardById = new Map(cards.map((card) => [card.id, card]));
    const responseCards = plan.map((card) => {
      const metadata = cardById.get(card.cardId);
      if (!metadata) throw new Error(`Drawn card ${card.cardId} disappeared from the deck`);
      return {
        reading_card_id: card.readingCardId,
        card_id: metadata.id,
        card_number: metadata.cardNumber,
        name_en: metadata.nameEn,
        name_vi: metadata.nameVi,
        arcana: metadata.arcana,
        suit: metadata.suit,
        image_url: metadata.imageUrl,
        orientation: card.orientation,
        position_id: card.positionId,
        position_key: card.positionKey,
        position_order: card.positionOrder,
        position_label: card.positionLabel,
      };
    });
    const response = {
      session_id: sessionId,
      locale: parsed.locale,
      deck: { id: deck.id, slug: deck.slug, name: deck.name, artist: deck.artist },
      category: {
        id: activeTemplate.category.id,
        slug: activeTemplate.category.slug,
        name: parsed.locale === "vi" ? activeTemplate.category.nameVi : activeTemplate.category.nameEn,
        description: parsed.locale === "vi" ? activeTemplate.category.descriptionVi : activeTemplate.category.descriptionEn,
      },
      spread: {
        id: activeTemplate.template.id,
        slug: activeTemplate.template.slug,
        name: parsed.locale === "vi" ? activeTemplate.template.nameVi : activeTemplate.template.nameEn,
        description: parsed.locale === "vi" ? activeTemplate.template.descriptionVi : activeTemplate.template.descriptionEn,
        card_count: activeTemplate.template.cardCount,
        spread_type: activeTemplate.template.spreadType,
        positions: positions.map((position) => ({ id: position.id, key: position.key, order: position.order, label: position.label })),
      },
      cards: responseCards,
    };
    const headers = new Headers({ "Content-Type": "application/json" });
    if (setCookie) headers.set("Set-Cookie", setCookie);
    return new Response(JSON.stringify(response), { status: 201, headers });
  });
}
