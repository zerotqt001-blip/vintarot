import type {
  TarotCatalog,
  TarotCatalogCategory,
  TarotCatalogPosition,
  TarotCatalogTemplate,
  TarotLocale,
} from "./tarot-catalog";

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

async function rows<T>(database: D1Database, statement: string): Promise<T[]> {
  const result = await database.prepare(statement).all();
  return result.results as unknown as T[];
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
  };
}
