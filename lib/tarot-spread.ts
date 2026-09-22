import type { TarotCatalogCategory, TarotCatalogPosition, TarotCatalogTemplate } from "./tarot-catalog";

export type ResolvedTarotSpreadPosition = Pick<
  TarotCatalogPosition,
  "id" | "templateId" | "key" | "order" | "label" | "description" | "prompt"
>;

export type ResolvedTarotSpread = {
  categoryId: TarotCatalogCategory["id"];
  categorySlug: TarotCatalogCategory["slug"];
  templateId: TarotCatalogTemplate["id"];
  slug: TarotCatalogTemplate["slug"];
  name: TarotCatalogTemplate["name"];
  description: TarotCatalogTemplate["description"];
  cardCount: TarotCatalogTemplate["cardCount"];
  spreadType: TarotCatalogTemplate["spreadType"];
  positions: ResolvedTarotSpreadPosition[];
  semantics?: TarotCatalogTemplate["semantics"];
};

/** Resolve one already-localized catalog template without changing its semantics. */
export function resolveTarotSpread(
  category: Pick<TarotCatalogCategory, "id" | "slug">,
  template: TarotCatalogTemplate,
): ResolvedTarotSpread {
  if (template.categoryId !== category.id) {
    throw new Error(`Spread ${template.slug} does not belong to category ${category.id}`);
  }

  if (template.cardCount !== template.positions.length) {
    throw new Error(
      `Spread ${template.slug} position count ${template.positions.length} does not match ${template.cardCount}`,
    );
  }

  const positions = [...template.positions]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map(({ id, templateId, key, order, label, description, prompt }) => ({
      id,
      templateId,
      key,
      order,
      label,
      description,
      prompt,
    }));

  return {
    categoryId: category.id,
    categorySlug: category.slug,
    templateId: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    cardCount: template.cardCount,
    spreadType: template.spreadType,
    positions,
    ...(template.semantics ? { semantics: template.semantics } : {}),
  };
}
