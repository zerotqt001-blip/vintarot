export type TarotLocale = "en" | "vi";
export type TarotOrientation = "upright" | "reversed";

export type LocalizedText = { en: string; vi: string };

export type TarotDeckSeed = {
  id: string;
  slug: string;
  name: string;
  artist: string;
  description: string;
};

export type TarotCardSeed = {
  id: string;
  deckId: string;
  cardNumber: number;
  slug: string;
  nameEn: string;
  nameVi: string;
  arcana: string;
  suit: string;
  imageUrl: string;
  displayOrder: number;
};

export type TarotMeaningSeed = {
  id: string;
  cardId: string;
  locale: TarotLocale;
  orientation: TarotOrientation;
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

export type TarotCategorySeed = {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  imageUrl: string | null;
  displayOrder: number;
  active: boolean;
};

export type TarotTemplateSeed = {
  id: string;
  categoryId: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  cardCount: number;
  spreadType: string;
  displayOrder: number;
  active: boolean;
};

export type TarotPositionSeed = {
  id: string;
  templateId: string;
  key: string;
  order: number;
  label: LocalizedText;
  description: LocalizedText;
  prompt: LocalizedText;
};

export type TarotSeed = {
  deck: TarotDeckSeed;
  cards: TarotCardSeed[];
  meanings: TarotMeaningSeed[];
  categories: TarotCategorySeed[];
  templates: TarotTemplateSeed[];
  positions: TarotPositionSeed[];
};

export type TarotCatalogPosition = Omit<TarotPositionSeed, "label" | "description" | "prompt"> & {
  label: string;
  description: string;
  prompt: string;
};

export type TarotCatalogTemplate = Omit<TarotTemplateSeed, "name" | "description"> & {
  name: string;
  description: string;
  positions: TarotCatalogPosition[];
};

export type TarotCatalogCategory = Omit<TarotCategorySeed, "name" | "description"> & {
  name: string;
  description: string;
  templates: TarotCatalogTemplate[];
};

export type TarotCatalog = {
  locale: TarotLocale;
  categories: TarotCatalogCategory[];
};

export type TarotDrawPlanCard = {
  readingCardId: string;
  cardId: string;
  cardNumber: number;
  positionId: string;
  positionKey: string;
  positionOrder: number;
  positionLabel: string;
  orientation: TarotOrientation;
};

type PositionDefinition = {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  prompt: LocalizedText;
};

type TemplateDefinition = {
  categoryId: string;
  categorySlug: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  spreadType: string;
  displayOrder: number;
  positions: PositionDefinition[];
};

const category = (
  id: string,
  slug: string,
  name: LocalizedText,
  description: LocalizedText,
  icon: string,
  displayOrder: number,
): TarotCategorySeed => ({
  id,
  slug,
  name,
  description,
  icon,
  imageUrl: null,
  displayOrder,
  active: true,
});

const position = (
  key: string,
  label: LocalizedText,
  description: LocalizedText,
  prompt: LocalizedText,
): PositionDefinition => ({ key, label, description, prompt });

const categories: TarotCategorySeed[] = [
  category("category-relationships", "relationships", { en: "Relationships", vi: "Mối quan hệ" }, { en: "Connection, honesty, and the space between people.", vi: "Kết nối, sự thành thật và khoảng không giữa những người với nhau." }, "heart", 0),
  category("category-planning", "planning", { en: "Planning", vi: "Lập kế hoạch" }, { en: "Practical direction for the next clear step.", vi: "Định hướng thực tế cho bước đi rõ ràng tiếp theo." }, "compass", 1),
  category("category-moon-phase", "moon-phase", { en: "Moon Phase", vi: "Giai đoạn mặt trăng" }, { en: "A quiet view of the cycle you are moving through.", vi: "Một góc nhìn tĩnh lặng về chu kỳ bạn đang đi qua." }, "moon", 2),
  category("category-creativity", "creativity", { en: "Creativity", vi: "Sáng tạo" }, { en: "Make room for feeling, energy, and creative renewal.", vi: "Tạo không gian cho cảm xúc, năng lượng và sự hồi phục sáng tạo." }, "sparkles", 3),
  category("category-business", "business", { en: "Business", vi: "Công việc" }, { en: "Work, resources, and grounded decisions.", vi: "Công việc, nguồn lực và những quyết định vững vàng." }, "briefcase", 4),
  category("category-fools-journey", "fools-journey", { en: "Fool’s Journey", vi: "Hành trình của Kẻ Khờ" }, { en: "A wider map for a chapter that is still unfolding.", vi: "Một bản đồ rộng hơn cho chương đời vẫn đang mở ra." }, "infinity", 5),
];

const templateDefinitions: TemplateDefinition[] = [
  {
    categoryId: "category-relationships",
    categorySlug: "relationships",
    slug: "relationship-check-in",
    name: { en: "Relationship check-in", vi: "Nhìn lại mối quan hệ" },
    description: { en: "See the relationship from three honest angles.", vi: "Nhìn mối quan hệ từ ba góc nhìn thành thật." },
    spreadType: "relationship",
    displayOrder: 0,
    positions: [
      position("you", { en: "You", vi: "Bạn" }, { en: "Your place in this connection.", vi: "Vị trí của bạn trong kết nối này." }, { en: "How are you showing up in this relationship?", vi: "Bạn đang hiện diện thế nào trong mối quan hệ này?" }),
      position("connection", { en: "Connection", vi: "Kết nối" }, { en: "The shared space between you.", vi: "Không gian chung giữa hai người." }, { en: "What is the relationship asking both people to notice?", vi: "Mối quan hệ đang mời cả hai người nhận ra điều gì?" }),
      position("them", { en: "Them", vi: "Người kia" }, { en: "The other person’s visible place in the story.", vi: "Vị trí có thể quan sát của người kia trong câu chuyện." }, { en: "What might help you meet the other person with clarity?", vi: "Điều gì có thể giúp bạn gặp người kia bằng sự rõ ràng?" }),
    ],
  },
  {
    categoryId: "category-planning",
    categorySlug: "planning",
    slug: "one-small-step",
    name: { en: "One small step", vi: "Một bước nhỏ" },
    description: { en: "Find one practical next move.", vi: "Tìm một bước đi thực tế tiếp theo." },
    spreadType: "single",
    displayOrder: 0,
    positions: [position("next_step", { en: "Your focus", vi: "Trọng tâm của bạn" }, { en: "The smallest useful place to begin.", vi: "Nơi nhỏ nhất nhưng hữu ích để bắt đầu." }, { en: "What is one kind, practical step you can take next?", vi: "Một bước đi tử tế và thực tế bạn có thể làm tiếp theo là gì?" })],
  },
  {
    categoryId: "category-planning",
    categorySlug: "planning",
    slug: "past-present-future",
    name: { en: "Past · Present · Future", vi: "Quá khứ · Hiện tại · Tương lai" },
    description: { en: "Notice the movement of a situation through time.", vi: "Nhận ra chuyển động của một tình huống qua thời gian." },
    spreadType: "timeline",
    displayOrder: 1,
    positions: [
      position("past", { en: "Past", vi: "Quá khứ" }, { en: "What shaped the question.", vi: "Điều đã định hình câu hỏi." }, { en: "What from the past still informs this situation?", vi: "Điều gì từ quá khứ vẫn đang ảnh hưởng tình huống này?" }),
      position("present", { en: "Present", vi: "Hiện tại" }, { en: "The energy available now.", vi: "Năng lượng đang có ở hiện tại." }, { en: "What is most important to see clearly right now?", vi: "Điều quan trọng nhất cần nhìn rõ lúc này là gì?" }),
      position("future", { en: "Future", vi: "Tương lai" }, { en: "The direction that may grow from today’s choices.", vi: "Hướng có thể lớn lên từ lựa chọn hôm nay." }, { en: "What direction opens if you respond with attention?", vi: "Hướng nào mở ra nếu bạn đáp lại bằng sự tỉnh thức?" }),
    ],
  },
  {
    categoryId: "category-moon-phase",
    categorySlug: "moon-phase",
    slug: "three-card-insight",
    name: { en: "Three-card insight", vi: "Thấu hiểu qua ba lá" },
    description: { en: "Name the self, the friction, and a possible response.", vi: "Gọi tên bản thân, điểm vướng và một cách đáp lại khả dĩ." },
    spreadType: "insight",
    displayOrder: 0,
    positions: [
      position("persona", { en: "Persona", vi: "Bản thân" }, { en: "The part of you meeting this moment.", vi: "Phần trong bạn đang gặp khoảnh khắc này." }, { en: "What part of yourself is most present in this question?", vi: "Phần nào trong bạn đang hiện diện rõ nhất trong câu hỏi này?" }),
      position("obstacle", { en: "Obstacle", vi: "Trở ngại" }, { en: "The friction that asks for attention.", vi: "Điểm ma sát đang cần được chú ý." }, { en: "What is making this harder to move through?", vi: "Điều gì khiến bạn khó đi qua chuyện này hơn?" }),
      position("solution", { en: "Solution", vi: "Hướng giải quyết" }, { en: "A response that creates more room.", vi: "Một cách đáp lại tạo thêm không gian." }, { en: "What response could make the next step more possible?", vi: "Cách đáp lại nào có thể khiến bước tiếp theo khả thi hơn?" }),
    ],
  },
  {
    categoryId: "category-creativity",
    categorySlug: "creativity",
    slug: "social-battery-check",
    name: { en: "Social battery check", vi: "Kiểm tra năng lượng xã hội" },
    description: { en: "Listen to the feeling and the need underneath it.", vi: "Lắng nghe cảm xúc và nhu cầu nằm bên dưới." },
    spreadType: "wellbeing",
    displayOrder: 0,
    positions: [
      position("how_i_feel", { en: "How I feel", vi: "Tôi cảm thấy gì" }, { en: "The feeling asking to be named.", vi: "Cảm xúc đang muốn được gọi tên." }, { en: "What feeling deserves a little more honesty today?", vi: "Hôm nay cảm xúc nào xứng đáng được thành thật hơn một chút?" }),
      position("what_i_need", { en: "What I need", vi: "Tôi cần gì" }, { en: "The care or boundary that may restore energy.", vi: "Sự chăm sóc hoặc ranh giới có thể hồi phục năng lượng." }, { en: "What do you need to receive, protect, or say no to?", vi: "Bạn cần nhận lấy, bảo vệ hoặc từ chối điều gì?" }),
    ],
  },
  {
    categoryId: "category-business",
    categorySlug: "business",
    slug: "past-present-future",
    name: { en: "Past · Present · Future", vi: "Quá khứ · Hiện tại · Tương lai" },
    description: { en: "See the work question as a changing sequence.", vi: "Nhìn câu hỏi công việc như một chuỗi đang thay đổi." },
    spreadType: "timeline",
    displayOrder: 0,
    positions: [
      position("past", { en: "Past", vi: "Quá khứ" }, { en: "The work pattern that brought you here.", vi: "Mẫu hình công việc đã đưa bạn đến đây." }, { en: "What earlier choice or pattern still matters at work?", vi: "Lựa chọn hoặc mẫu hình nào trước đây vẫn quan trọng trong công việc?" }),
      position("present", { en: "Present", vi: "Hiện tại" }, { en: "The resource or decision in front of you.", vi: "Nguồn lực hoặc quyết định đang ở trước mắt." }, { en: "What deserves your clearest practical attention now?", vi: "Điều gì xứng đáng với sự chú ý thực tế rõ ràng nhất lúc này?" }),
      position("future", { en: "Future", vi: "Tương lai" }, { en: "A direction shaped by the next decision.", vi: "Hướng đi được định hình bởi quyết định tiếp theo." }, { en: "What direction can grow from a sustainable choice?", vi: "Hướng nào có thể lớn lên từ một lựa chọn bền vững?" }),
    ],
  },
  {
    categoryId: "category-fools-journey",
    categorySlug: "fools-journey",
    slug: "celtic-cross",
    name: { en: "Celtic cross", vi: "Thập tự Celtic" },
    description: { en: "A fuller map for a layered question.", vi: "Một bản đồ đầy đặn hơn cho câu hỏi nhiều lớp." },
    spreadType: "celtic-cross",
    displayOrder: 0,
    positions: [
      position("the_present", { en: "The present", vi: "Hiện tại" }, { en: "The central energy now.", vi: "Năng lượng trung tâm lúc này." }, { en: "What is the core of this situation today?", vi: "Cốt lõi của tình huống này hôm nay là gì?" }),
      position("the_challenge", { en: "The challenge", vi: "Thử thách" }, { en: "What crosses or complicates the center.", vi: "Điều cắt ngang hoặc làm phức tạp trung tâm." }, { en: "What needs to be met without turning into a verdict?", vi: "Điều gì cần được đối diện mà không biến thành phán quyết?" }),
      position("foundation", { en: "Foundation", vi: "Nền tảng" }, { en: "The root beneath the visible moment.", vi: "Gốc rễ bên dưới khoảnh khắc đang thấy." }, { en: "What foundation is quietly supporting or limiting this?", vi: "Nền tảng nào đang âm thầm nâng đỡ hoặc giới hạn chuyện này?" }),
      position("recent_past", { en: "Recent past", vi: "Quá khứ gần" }, { en: "The recent movement that still echoes.", vi: "Chuyển động gần đây vẫn còn vang lại." }, { en: "What recent event changed the shape of the question?", vi: "Sự kiện gần đây nào đã đổi hình dạng của câu hỏi?" }),
      position("possibility", { en: "Possibility", vi: "Khả năng" }, { en: "An opening that may become available.", vi: "Một lối mở có thể xuất hiện." }, { en: "What possibility is worth approaching with care?", vi: "Khả năng nào đáng được tiếp cận bằng sự cẩn trọng?" }),
      position("near_future", { en: "Near future", vi: "Tương lai gần" }, { en: "The next movement in the pattern.", vi: "Chuyển động tiếp theo trong mẫu hình." }, { en: "What is likely to ask for attention next?", vi: "Điều gì có khả năng cần được chú ý tiếp theo?" }),
      position("your_approach", { en: "Your approach", vi: "Cách bạn tiếp cận" }, { en: "How you are meeting the situation.", vi: "Cách bạn đang gặp tình huống." }, { en: "What quality are you bringing to this question?", vi: "Bạn đang mang phẩm chất nào đến câu hỏi này?" }),
      position("your_surroundings", { en: "Your surroundings", vi: "Môi trường xung quanh" }, { en: "The context and people around you.", vi: "Bối cảnh và những người xung quanh bạn." }, { en: "What in your environment is shaping your choices?", vi: "Điều gì trong môi trường đang định hình lựa chọn của bạn?" }),
      position("hopes_and_fears", { en: "Hopes and fears", vi: "Hy vọng và nỗi sợ" }, { en: "The longing and worry held together.", vi: "Điều mong mỏi và lo lắng đang cùng tồn tại." }, { en: "What hope or fear deserves to be seen without taking over?", vi: "Hy vọng hoặc nỗi sợ nào cần được nhìn thấy mà không chi phối tất cả?" }),
      position("direction", { en: "Direction", vi: "Hướng đi" }, { en: "A grounded way to carry the reading forward.", vi: "Một cách vững vàng để đưa trải bài đi tiếp." }, { en: "What direction lets you move forward with more choice?", vi: "Hướng nào giúp bạn đi tiếp với nhiều lựa chọn hơn?" }),
    ],
  },
];

const templateParts = templateDefinitions.map((definition) => {
  const id = `spread-${definition.categorySlug}-${definition.slug}`;
  const template: TarotTemplateSeed = {
    id,
    categoryId: definition.categoryId,
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    cardCount: definition.positions.length,
    spreadType: definition.spreadType,
    displayOrder: definition.displayOrder,
    active: true,
  };
  const positions: TarotPositionSeed[] = definition.positions.map((item, order) => ({
    id: `${id}-${item.key}`,
    templateId: id,
    key: item.key,
    order,
    label: item.label,
    description: item.description,
    prompt: item.prompt,
  }));
  return { template, positions };
});

export const currentSpreadCatalog = {
  categories,
  templates: templateParts.map((part) => part.template),
  positions: templateParts.flatMap((part) => part.positions),
};
