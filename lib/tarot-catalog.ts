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
  category("category-blank", "blank", { en: "Blank", vi: "Trống" }, { en: "A clear table for a free-form reading.", vi: "Một mặt bàn trống cho trải bài tự do." }, "square", 0),
  category("category-everyday", "everyday", { en: "Everyday", vi: "Hằng ngày" }, { en: "Small questions, daily energy, and the next moment.", vi: "Những câu hỏi nhỏ, năng lượng mỗi ngày và khoảnh khắc kế tiếp." }, "sun", 1),
  category("category-self-care", "self-care", { en: "Self-care", vi: "Chăm sóc bản thân" }, { en: "A kinder look at needs, boundaries, and renewal.", vi: "Một góc nhìn dịu dàng hơn về nhu cầu, ranh giới và hồi phục." }, "sparkles", 2),
  category("category-relationships", "relationships", { en: "Relationships", vi: "Mối quan hệ" }, { en: "Connection, honesty, and the space between people.", vi: "Kết nối, sự thành thật và khoảng không giữa những người với nhau." }, "heart", 3),
  category("category-planning", "planning", { en: "Planning", vi: "Lập kế hoạch" }, { en: "Practical direction for the next clear step.", vi: "Định hướng thực tế cho bước đi rõ ràng tiếp theo." }, "compass", 4),
  category("category-moon-phase", "moon-phase", { en: "Moon Phase", vi: "Giai đoạn mặt trăng" }, { en: "A quiet view of the cycle you are moving through.", vi: "Một góc nhìn tĩnh lặng về chu kỳ bạn đang đi qua." }, "moon", 5),
  category("category-creativity", "creativity", { en: "Creativity", vi: "Sáng tạo" }, { en: "Make room for feeling, energy, and creative renewal.", vi: "Tạo không gian cho cảm xúc, năng lượng và sự hồi phục sáng tạo." }, "sparkles", 6),
  category("category-business", "business", { en: "Business", vi: "Công việc" }, { en: "Work, resources, and grounded decisions.", vi: "Công việc, nguồn lực và những quyết định vững vàng." }, "briefcase", 7),
  category("category-fools-journey", "fools-journey", { en: "Fool’s Journey", vi: "Hành trình của Kẻ Khờ" }, { en: "A wider map for a chapter that is still unfolding.", vi: "Một bản đồ rộng hơn cho chương đời vẫn đang mở ra." }, "infinity", 8),
];

type PositionTuple = readonly [key: string, en: string, vi: string];

function moonlightPosition([key, en, vi]: PositionTuple): PositionDefinition {
  return position(
    key,
    { en, vi },
    { en: `The “${en}” position in this reading.`, vi: `Vị trí “${vi}” trong trải bài này.` },
    { en: `What might “${en}” reveal about this question?`, vi: `Vị trí “${vi}” đang soi sáng điều gì trong câu hỏi này?` },
  );
}

function spreadTemplate(
  categorySlug: string,
  slug: string,
  name: LocalizedText,
  spreadType: string,
  displayOrder: number,
  positions: PositionTuple[],
  description?: LocalizedText,
): TemplateDefinition {
  return {
    categoryId: `category-${categorySlug}`,
    categorySlug,
    slug,
    name,
    description: description || {
      en: `${name.en} — a Moonlight-inspired reading for a focused question.`,
      vi: `${name.vi} — một trải bài lấy cảm hứng từ Moonlight cho câu hỏi tập trung.`,
    },
    spreadType,
    displayOrder,
    positions: positions.map(moonlightPosition),
  };
}

const pt = (key: string, en: string, vi: string): PositionTuple => [key, en, vi];

const templateDefinitions: TemplateDefinition[] = [
  // Everyday
  spreadTemplate("everyday", "persona-obstacle-solution", { en: "Persona, Obstacle, Solution", vi: "Bản thân, Trở ngại, Hướng giải quyết" }, "row-3", 0, [
    pt("persona", "Persona", "Bản thân"), pt("obstacle", "Obstacle", "Trở ngại"), pt("solution", "Solution", "Hướng giải quyết"),
  ]),
  spreadTemplate("everyday", "how-to-handle-it", { en: "How To Handle It", vi: "Cách xử lý" }, "row-2", 1, [
    pt("best_way", "Best way to handle this", "Cách tốt nhất để xử lý"), pt("worst_way", "Worst way to handle this", "Cách tệ nhất để xử lý"),
  ]),
  spreadTemplate("everyday", "give-receive-create", { en: "Give, Receive, Create", vi: "Cho đi, Đón nhận, Sáng tạo" }, "triangle", 2, [
    pt("giving", "I’m giving", "Tôi đang cho đi"), pt("receiving", "I’m receiving", "Tôi đang đón nhận"), pt("creation", "Combined creation", "Điều được cùng tạo ra"),
  ]),
  spreadTemplate("everyday", "todays-forecast", { en: "Today’s Forecast", vi: "Dự báo hôm nay" }, "row-3", 3, [
    pt("surface", "The Surface", "Bề mặt"), pt("undercurrent", "The Undercurrent", "Dòng chảy ngầm"), pt("forecast", "My Forecast", "Dự báo của tôi"),
  ]),
  spreadTemplate("everyday", "what-to-look-forward-to", { en: "What To Look Forward To", vi: "Điều đáng mong đợi" }, "row-2", 4, [
    pt("today_highlight", "A Highlight Today", "Điểm sáng hôm nay"), pt("next_week_highlight", "A Highlight Next Week", "Điểm sáng tuần tới"),
  ]),
  spreadTemplate("everyday", "energy-refresh", { en: "Energy Refresh", vi: "Làm mới năng lượng" }, "row-3", 5, [
    pt("repetitive", "What Feels Repetitive", "Điều đang lặp lại"), pt("life_giving", "What Gives You Life", "Điều tiếp thêm sức sống"), pt("shift", "How to Shift", "Cách chuyển hóa"),
  ]),
  spreadTemplate("everyday", "progress-check", { en: "Progress Check", vi: "Kiểm tra tiến trình" }, "row-2", 6, [
    pt("where_i_am", "Where I Am", "Tôi đang ở đâu"), pt("final_form", "My Final Form", "Hình hài sau cùng"),
  ]),
  spreadTemplate("everyday", "yesterday-today-tomorrow", { en: "Yesterday, Today, Tomorrow", vi: "Hôm qua, Hôm nay, Ngày mai" }, "row-3", 7, [
    pt("yesterday", "Yesterday", "Hôm qua"), pt("today", "Today", "Hôm nay"), pt("tomorrow", "Tomorrow", "Ngày mai"),
  ]),
  spreadTemplate("everyday", "last-night-this-morning", { en: "Last Night, This Morning", vi: "Đêm qua, Sáng nay" }, "row-2", 8, [
    pt("last_night", "Last Night I", "Đêm qua tôi"), pt("this_morning", "Woke Up Feeling Like", "Thức dậy với cảm giác"),
  ]),
  spreadTemplate("everyday", "my-energy-today", { en: "My Energy Today", vi: "Năng lượng hôm nay" }, "single", 9, [
    pt("energy_today", "My Energy Today", "Năng lượng hôm nay"),
  ]),

  // Self-care
  spreadTemplate("self-care", "setting-intentions", { en: "Setting Intentions", vi: "Đặt ý định" }, "row-3", 0, [
    pt("let_in", "What to Let In", "Điều nên đón vào"), pt("release", "What to Release", "Điều nên buông"), pt("where_to_go", "Where to Go", "Hướng nên đi"),
  ]),
  spreadTemplate("self-care", "mind-body-spirit", { en: "Mind, Body, Spirit", vi: "Tâm trí, Cơ thể, Tinh thần" }, "row-3", 1, [
    pt("mind", "Mind", "Tâm trí"), pt("body", "Body", "Cơ thể"), pt("spirit", "Spirit", "Tinh thần"),
  ]),
  spreadTemplate("self-care", "born-to-forced-to", { en: "Born To, Forced To", vi: "Sinh ra để, Bị buộc phải" }, "row-2", 2, [
    pt("born_to", "Born To", "Sinh ra để"), pt("forced_to", "Forced To", "Bị buộc phải"),
  ]),
  spreadTemplate("self-care", "love-deserve", { en: "Love, Deserve", vi: "Yêu thương, Xứng đáng" }, "row-2", 3, [
    pt("dont_love_at_my", "If you don’t love me at my", "Nếu bạn không yêu tôi khi tôi"), pt("dont_deserve_at_my", "You don’t deserve me at my", "Bạn không xứng đáng với tôi khi tôi"),
  ]),
  spreadTemplate("self-care", "big-feelings", { en: "Big Feelings", vi: "Cảm xúc lớn" }, "row-2", 4, [
    pt("feeling", "The Feeling", "Cảm xúc"), pt("ground", "How to Ground It", "Cách neo lại"),
  ]),
  spreadTemplate("self-care", "creativity-work-relationships", { en: "Creativity, Work, Relationships", vi: "Sáng tạo, Công việc, Mối quan hệ" }, "top-1-bottom-3", 5, [
    pt("persona", "Persona", "Bản thân"), pt("creativity", "Creativity", "Sáng tạo"), pt("work", "Work", "Công việc"), pt("relationships", "Relationships", "Mối quan hệ"),
  ]),
  spreadTemplate("self-care", "plot-twist-growth", { en: "Plot Twist, Growth", vi: "Bước ngoặt, Trưởng thành" }, "row-2", 6, [
    pt("plot_twist", "Plot Twist I Need", "Bước ngoặt tôi cần"), pt("growth_arc", "My Growth Arc", "Đường trưởng thành của tôi"),
  ]),
  spreadTemplate("self-care", "strength-weakness-magic", { en: "Strength, Weakness, Magic", vi: "Điểm mạnh, Điểm yếu, Phép màu" }, "row-3", 7, [
    pt("strength", "Strength", "Điểm mạnh"), pt("weakness", "Weakness", "Điểm yếu"), pt("magic", "Magic", "Phép màu"),
  ]),

  // Relationships
  spreadTemplate("relationships", "relationship-check-in", { en: "Relationship Check-In", vi: "Kiểm tra mối quan hệ" }, "row-3", 0, [
    pt("us_right_now", "Us Right Now", "Chúng ta lúc này"), pt("needs_work", "What Needs Work", "Điều cần cải thiện"), pt("can_help", "What Can Help", "Điều có thể giúp"),
  ]),
  spreadTemplate("relationships", "act-or-wait", { en: "Act or Wait", vi: "Hành động hay chờ đợi" }, "row-2", 1, [
    pt("act", "If I Act", "Nếu tôi hành động"), pt("wait", "If I Wait", "Nếu tôi chờ"),
  ]),
  spreadTemplate("relationships", "new-connection", { en: "New Connection", vi: "Kết nối mới" }, "row-3", 2, [
    pt("first_spark", "First Spark", "Tia lửa đầu tiên"), pt("effects", "Effects", "Ảnh hưởng"), pt("next_steps", "Next Steps", "Bước tiếp theo"),
  ]),
  spreadTemplate("relationships", "dating-vibe", { en: "Dating Vibe", vi: "Năng lượng hẹn hò" }, "row-3", 3, [
    pt("your_vibe", "Your Vibe", "Năng lượng của bạn"), pt("their_vibe", "Their Vibe", "Năng lượng của họ"), pt("flow", "The Flow", "Dòng chảy"),
  ]),
  spreadTemplate("relationships", "attracting-love", { en: "Attracting Love", vi: "Thu hút tình yêu" }, "row-4", 4, [
    pt("attracting_now", "What I’m Attracting Now", "Điều tôi đang thu hút"), pt("should_attract", "What I Should Attract", "Điều tôi nên thu hút"), pt("blocking", "What’s Blocking Me", "Điều đang cản tôi"), pt("invite_love", "How to Invite Love In", "Cách mời tình yêu vào"),
  ]),
  spreadTemplate("relationships", "better-communication", { en: "Better Communication", vi: "Giao tiếp tốt hơn" }, "row-3", 5, [
    pt("saying", "What I’m Saying", "Điều tôi đang nói"), pt("hearing", "What They’re Hearing", "Điều họ đang nghe"), pt("align", "How to Align", "Cách đồng điệu"),
  ]),
  spreadTemplate("relationships", "conflict-resolution", { en: "Conflict & Resolution", vi: "Xung đột & Giải pháp" }, "row-2", 6, [
    pt("root_issue", "Root of the Issue", "Gốc rễ vấn đề"), pt("resolve", "How to Resolve It", "Cách giải quyết"),
  ]),
  spreadTemplate("relationships", "unclear-feelings", { en: "Unclear Feelings", vi: "Cảm xúc chưa rõ" }, "row-3", 7, [
    pt("current_feelings", "Current Feelings", "Cảm xúc hiện tại"), pt("blocker", "The Blocker", "Điểm cản"), pt("path_through", "The Path Through", "Con đường đi qua"),
  ]),
  spreadTemplate("relationships", "your-path-together", { en: "Your Path Together", vi: "Con đường cùng nhau" }, "row-3", 8, [
    pt("your_gift", "Your Gift", "Món quà của bạn"), pt("their_gift", "Their Gift", "Món quà của họ"), pt("current_path", "Current Path", "Con đường hiện tại"),
  ]),
  spreadTemplate("relationships", "finding-your-people", { en: "Finding Your People", vi: "Tìm những người thuộc về mình" }, "row-4", 9, [
    pt("current_vibe", "Current Vibe", "Năng lượng hiện tại"), pt("stop", "What to Stop", "Điều nên dừng"), pt("nurture", "What to Nurture", "Điều nên nuôi dưỡng"), pt("community", "Where To Find Community", "Nơi tìm cộng đồng"),
  ]),
  spreadTemplate("relationships", "what-that-text-really-meant", { en: "What That Text Really Meant", vi: "Tin nhắn đó thực sự có ý gì" }, "row-3", 10, [
    pt("text", "The Text", "Tin nhắn"), pt("subtext", "The Subtext", "Hàm ý"), pt("reply", "The Reply", "Câu trả lời"),
  ]),

  // Planning
  spreadTemplate("planning", "celtic-cross", { en: "Celtic Cross", vi: "Thập tự Celtic" }, "celtic-cross", 0, [
    pt("present", "The Present", "Hiện tại"), pt("challenge", "The Challenge", "Thử thách"), pt("foundation", "Foundation", "Nền tảng"), pt("recent_past", "Recent Past", "Quá khứ gần"), pt("possibility", "Possibility", "Khả năng"), pt("near_future", "Near Future", "Tương lai gần"), pt("approach", "Your Approach", "Cách bạn tiếp cận"), pt("environment", "Your Environment", "Môi trường xung quanh"), pt("hopes_fears", "Hopes & Fears", "Hy vọng & Nỗi sợ"), pt("outcome", "Your Outcome", "Kết quả"),
  ]),
  spreadTemplate("planning", "stay-or-go", { en: "Stay or Go", vi: "Ở lại hay đi" }, "row-2", 1, [
    pt("stay", "Stay", "Ở lại"), pt("go", "Go", "Đi"),
  ]),
  spreadTemplate("planning", "yes-or-no", { en: "Yes or No", vi: "Có hay Không" }, "yes-no", 2, [
    pt("if_yes", "If Yes", "Nếu Có"), pt("if_no", "If No", "Nếu Không"), pt("yes_leads_to", "What yes leads to", "Điều Có dẫn đến"), pt("no_leads_to", "What no leads to", "Điều Không dẫn đến"),
  ]),
  spreadTemplate("planning", "goals-aspirations", { en: "Goals & Aspirations", vi: "Mục tiêu & Khát vọng" }, "row-3", 3, [
    pt("short_term", "Short-Term Goals", "Mục tiêu ngắn hạn"), pt("long_term", "Long-Term Aspirations", "Khát vọng dài hạn"), pt("steps_next", "Steps to Take Next", "Bước tiếp theo"),
  ]),
  spreadTemplate("planning", "past-present-future", { en: "Past, Present, Future", vi: "Quá khứ, Hiện tại, Tương lai" }, "row-3", 4, [
    pt("past", "Past", "Quá khứ"), pt("present", "Present", "Hiện tại"), pt("future", "Future", "Tương lai"),
  ]),
  spreadTemplate("planning", "already-learned-need-to-learn", { en: "Already Learned, Need to Learn", vi: "Đã học, Cần học" }, "row-2", 5, [
    pt("already_learned", "Already learned", "Đã học"), pt("need_to_learn", "Need to learn", "Cần học"),
  ]),
  spreadTemplate("planning", "conflict-bridge-path", { en: "Conflict, Bridge, Path", vi: "Xung đột, Cầu nối, Con đường" }, "cross-4", 6, [
    pt("your_energy", "Your energy", "Năng lượng của bạn"), pt("conflicting_energy", "Conflicting energy", "Năng lượng xung đột"), pt("bridge", "The bridge", "Cầu nối"), pt("path", "The path", "Con đường"),
  ]),
  spreadTemplate("planning", "career-crossroads", { en: "Career Crossroads", vi: "Ngã rẽ sự nghiệp" }, "row-3", 7, [
    pt("current_path", "Current Path", "Con đường hiện tại"), pt("new_potential", "New Potential", "Tiềm năng mới"), pt("directions_steps", "Directions & Steps", "Hướng đi & Bước tiến"),
  ]),
  spreadTemplate("planning", "finding-home", { en: "Finding Home", vi: "Tìm nơi thuộc về" }, "row-4", 8, [
    pt("current_place", "Current Place", "Nơi hiện tại"), pt("ideal_environment", "Ideal Environment", "Môi trường lý tưởng"), pt("ideal_people", "Ideal People", "Những người lý tưởng"), pt("get_there", "How to Get There", "Cách đi đến đó"),
  ]),

  // Moon Phase
  spreadTemplate("moon-phase", "first-quarter-moon", { en: "First Quarter Moon 🌓", vi: "Trăng thượng huyền 🌓" }, "row-3", 0, [
    pt("building", "What I’m Building", "Điều tôi đang xây dựng"), pt("pushing_back", "What’s Pushing Back", "Điều đang cản lại"), pt("push_through", "How I Push Through", "Cách tôi vượt qua"),
  ]),
  spreadTemplate("moon-phase", "waxing-gibbous", { en: "Waxing Gibbous 🌔", vi: "Trăng khuyết lớn 🌔" }, "row-3", 1, [
    pt("working", "What’s Working", "Điều đang hiệu quả"), pt("needs_work", "What Needs Work", "Điều cần cải thiện"), pt("perfect", "How to Perfect It", "Cách hoàn thiện"),
  ]),
  spreadTemplate("moon-phase", "full-moon", { en: "Full Moon 🌕", vi: "Trăng tròn 🌕" }, "row-3", 2, [
    pt("see_clearly", "What I See Clearly", "Điều tôi nhìn rõ"), pt("outgrown", "What I’ve Outgrown", "Điều tôi đã vượt qua"), pt("keeping", "What I’m Keeping", "Điều tôi giữ lại"),
  ]),
  spreadTemplate("moon-phase", "waning-gibbous", { en: "Waning Gibbous 🌖", vi: "Trăng khuyết tàn 🌖" }, "row-3", 3, [
    pt("share", "What to Share", "Điều nên chia sẻ"), pt("gets_it", "Who Gets It", "Ai sẽ thấu hiểu"), pt("share_how", "How to Share It", "Cách chia sẻ"),
  ]),
  spreadTemplate("moon-phase", "last-quarter-moon", { en: "Last Quarter Moon 🌗", vi: "Trăng hạ huyền 🌗" }, "row-3", 4, [
    pt("release", "What to Release", "Điều nên buông"), pt("holding_on", "Why I’m Holding On", "Vì sao tôi còn níu giữ"), pt("let_go", "How to Let Go", "Cách buông bỏ"),
  ]),
  spreadTemplate("moon-phase", "waning-crescent", { en: "Waning Crescent 🌘", vi: "Trăng lưỡi liềm tàn 🌘" }, "row-3", 5, [
    pt("needs_rest", "What Needs Rest", "Điều cần nghỉ ngơi"), pt("release_it", "How I Release It", "Cách tôi buông điều đó"), pt("learned", "What I Learned", "Điều tôi đã học"),
  ]),
  spreadTemplate("moon-phase", "new-moon", { en: "New Moon 🌑", vi: "Trăng non 🌑" }, "row-3", 6, [
    pt("foundation", "My Foundation", "Nền tảng của tôi"), pt("spark", "My Spark", "Tia lửa của tôi"), pt("leads", "Where it Leads", "Nó dẫn tới đâu"),
  ]),
  spreadTemplate("moon-phase", "waxing-crescent", { en: "Waxing Crescent 🌒", vi: "Trăng lưỡi liềm non 🌒" }, "row-3", 7, [
    pt("plant", "What to Plant", "Điều nên gieo"), pt("nurture", "What to Nurture", "Điều nên nuôi dưỡng"), pt("blossom", "What Will Blossom", "Điều sẽ nở rộ"),
  ]),

  // Creativity
  spreadTemplate("creativity", "getting-unstuck", { en: "Getting Unstuck", vi: "Thoát khỏi bế tắc" }, "row-3", 0, [
    pt("blocker", "Blocker", "Điểm cản"), pt("spark", "Spark", "Tia lửa"), pt("flow", "Flow", "Dòng chảy"),
  ]),
  spreadTemplate("creativity", "seed-sprout-harvest", { en: "Seed, Sprout, Harvest", vi: "Hạt giống, Mầm non, Thu hoạch" }, "row-3", 1, [
    pt("seed", "Seed", "Hạt giống"), pt("sprout", "Sprout", "Mầm non"), pt("harvest", "Harvest", "Thu hoạch"),
  ]),
  spreadTemplate("creativity", "collaboration-energy", { en: "Collaboration Energy", vi: "Năng lượng hợp tác" }, "row-3", 2, [
    pt("your_magic", "Your Magic", "Phép màu của bạn"), pt("their_magic", "Their Magic", "Phép màu của họ"), pt("intersection", "The Intersection", "Điểm giao nhau"),
  ]),
  spreadTemplate("creativity", "creative-direction", { en: "Creative Direction", vi: "Định hướng sáng tạo" }, "row-3", 3, [
    pt("message", "Your Message", "Thông điệp của bạn"), pt("style", "Your Style", "Phong cách của bạn"), pt("audience", "Your Audience", "Khán giả của bạn"),
  ]),

  // Business
  spreadTemplate("business", "finding-your-magic", { en: "Finding Your Magic", vi: "Tìm phép màu của bạn" }, "row-4", 0, [
    pt("gift", "Your Gift", "Món quà của bạn"), pt("magic", "Your Magic", "Phép màu của bạn"), pt("yearning", "Their Yearning", "Khát vọng của họ"), pt("beacon", "The Beacon", "Ngọn hải đăng"),
  ]),
  spreadTemplate("business", "the-big-meeting", { en: "The Big Meeting", vi: "Cuộc gặp quan trọng" }, "row-3", 1, [
    pt("strength", "Your Strength", "Điểm mạnh của bạn"), pt("needs", "Their Needs", "Nhu cầu của họ"), pt("bridge", "The Bridge", "Cầu nối"),
  ]),
  spreadTemplate("business", "product-market-fit", { en: "Product Market Fit", vi: "Độ phù hợp sản phẩm - thị trường" }, "row-5", 2, [
    pt("product_persona", "Product Persona", "Chân dung sản phẩm"), pt("community", "Current Community", "Cộng đồng hiện tại"), pt("market", "Potential Market", "Thị trường tiềm năng"), pt("missing_piece", "The Missing Piece", "Mảnh ghép còn thiếu"), pt("big_shift", "Big Shift", "Chuyển dịch lớn"),
  ]),
  spreadTemplate("business", "strategic-overview-swot", { en: "Strategic Overview (SWOT)", vi: "Tổng quan chiến lược (SWOT)" }, "row-4", 3, [
    pt("strength", "Strength", "Điểm mạnh"), pt("weakness", "Weakness", "Điểm yếu"), pt("opportunity", "Opportunity", "Cơ hội"), pt("threat", "Threat", "Thách thức"),
  ]),

  // Fool’s Journey
  spreadTemplate("fools-journey", "between-worlds", { en: "Between Worlds", vi: "Giữa những thế giới" }, "row-4", 0, [
    pt("cliff", "The Cliff", "Vách đá"), pt("bundle", "The Bundle", "Gói hành trang"), pt("dog", "The Dog", "Chú chó"), pt("leap", "The Leap", "Cú nhảy"),
  ]),
  spreadTemplate("fools-journey", "safe-choice-wild-choice", { en: "Safe Choice, Wild Choice", vi: "Lựa chọn an toàn, Lựa chọn mạo hiểm" }, "row-2", 1, [
    pt("safe", "Safe Choice", "Lựa chọn an toàn"), pt("wild", "Wild Choice", "Lựa chọn mạo hiểm"),
  ]),
  spreadTemplate("fools-journey", "divine-mischief", { en: "Divine Mischief", vi: "Trò tinh nghịch thiêng liêng" }, "row-3", 2, [
    pt("too_serious", "What’s too serious", "Điều đang quá nghiêm trọng"), pt("play", "What needs play", "Điều cần sự vui chơi"), pt("surprise", "The surprise gift", "Món quà bất ngờ"),
  ]),
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
