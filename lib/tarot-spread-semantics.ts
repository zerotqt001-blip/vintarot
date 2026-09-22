import type { LocalizedText, TarotLocale } from "./tarot-catalog";

export type TarotSpreadInterpretationStrategy =
  | "sequence"
  | "contrast"
  | "branching"
  | "timeline"
  | "tension-resolution"
  | "system";

export type TarotSpreadRelationship = {
  from: string;
  to: string;
  relation: string;
};

export type TarotSpreadSemantics = {
  purpose: string;
  questionSuitability: string[];
  interpretationStrategy: TarotSpreadInterpretationStrategy;
  temporalFocus: string | null;
  interpretationEmphasis: string[];
  synthesisGuidance: string;
  positionRelationships: TarotSpreadRelationship[];
};

type LocalizedRelationship = Omit<TarotSpreadRelationship, "relation"> & { relation: LocalizedText };

export type TarotSpreadSemanticsSeed = {
  purpose: LocalizedText;
  questionSuitability: LocalizedText[];
  interpretationStrategy: TarotSpreadInterpretationStrategy;
  temporalFocus: LocalizedText | null;
  interpretationEmphasis: LocalizedText[];
  synthesisGuidance: LocalizedText;
  positionRelationships: LocalizedRelationship[];
};

export type TarotSpreadSemanticsInput = {
  categorySlug: string;
  categoryName: LocalizedText;
  categoryDescription: LocalizedText;
  template: {
    slug: string;
    name: LocalizedText;
    description: LocalizedText;
    spreadType: string;
    cardCount: number;
  };
  positions: Array<{
    key: string;
    order: number;
    label: LocalizedText;
    description: LocalizedText;
  }>;
};

export type LocalizedTarotSpreadSemanticsInput = {
  categorySlug: string;
  categoryName: string;
  categoryDescription: string;
  template: {
    slug: string;
    name: string;
    description: string;
    spreadType: string;
    cardCount: number;
  };
  positions: Array<{
    key: string;
    order: number;
    label: string;
    description: string;
  }>;
};

const text = (en: string, vi: string): LocalizedText => ({ en, vi });

function localized(value: LocalizedText, locale: TarotLocale): string {
  return value[locale];
}

function lower(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function strategyFor(input: TarotSpreadSemanticsInput, keys: string[]): TarotSpreadInterpretationStrategy {
  const signature = `${input.template.slug} ${input.template.spreadType} ${keys.join(" ")}`.toLocaleLowerCase();
  if (/(yes-no|safe-choice|stay-or-go|if_yes|if_no)/u.test(signature)) return "branching";
  if (input.template.slug === "celtic-cross") return "system";
  if (/(past-present|yesterday|tomorrow|recent_past|near_future|future|forecast|moon)/u.test(signature)) return "timeline";
  if (/(conflict|challenge|obstacle|blocker|bridge|resolve|path|problem)/u.test(signature)) return "tension-resolution";
  if (input.template.spreadType === "triangle" || input.template.spreadType.startsWith("top-") || input.template.spreadType.startsWith("cross-")) return "system";
  if (input.template.cardCount === 2) return "contrast";
  return "sequence";
}

function strategyCopy(strategy: TarotSpreadInterpretationStrategy): LocalizedText {
  switch (strategy) {
    case "branching": return text("Compare the available paths, then read each outcome as conditional rather than certain.", "Đặt các hướng đi cạnh nhau, rồi đọc kết quả như những khả năng có điều kiện chứ không phải điều chắc chắn.");
    case "contrast": return text("Read the positions as a deliberate contrast before deciding what they reveal together.", "Đọc các vị trí như một sự tương phản có chủ ý trước khi nhìn vào điều chúng cùng hé lộ.");
    case "timeline": return text("Read the positions as a movement through time or changing conditions, not as isolated predictions.", "Đọc các vị trí như một chuyển động theo thời gian hoặc điều kiện đang đổi thay, không phải những lời đoán tách rời.");
    case "tension-resolution": return text("Name the tension first, then connect the bridge or next path to an observable choice.", "Gọi tên điểm căng thẳng trước, rồi nối cây cầu hoặc hướng đi tiếp theo với một lựa chọn có thể quan sát.");
    case "system": return text("Let each position contribute a different angle to one whole situation and synthesize the pattern across them.", "Để mỗi vị trí bổ sung một góc nhìn cho cùng một tình huống, rồi kết nối thành một bức tranh chung.");
    default: return text("Read the positions as a progression in which each answer changes the meaning of the next.", "Đọc các vị trí như một tiến trình, trong đó mỗi câu trả lời làm rõ hơn ý nghĩa của vị trí tiếp theo.");
  }
}

function strategyQuestion(strategy: TarotSpreadInterpretationStrategy): LocalizedText {
  switch (strategy) {
    case "branching": return text("questions that compare choices, risks, or possible next paths", "câu hỏi muốn so sánh lựa chọn, rủi ro hoặc những hướng đi tiếp theo");
    case "contrast": return text("questions that need two needs, options, or perspectives held side by side", "câu hỏi cần đặt hai nhu cầu, lựa chọn hoặc góc nhìn cạnh nhau");
    case "timeline": return text("questions about change, cycles, timing, or what is developing", "câu hỏi về thay đổi, chu kỳ, thời điểm hoặc điều đang dần hình thành");
    case "tension-resolution": return text("questions about an obstacle, conflict, boundary, or practical way forward", "câu hỏi về trở ngại, xung đột, ranh giới hoặc cách tiến về phía trước");
    case "system": return text("questions that need several connected perspectives before a decision", "câu hỏi cần nhiều góc nhìn liên kết trước khi đi đến một quyết định");
    default: return text("focused questions where the order of the positions matters", "câu hỏi tập trung trong đó thứ tự các vị trí có ý nghĩa");
  }
}

function categoryQuestion(input: TarotSpreadSemanticsInput): LocalizedText {
  const slug = lower(input.categorySlug);
  if (slug === "relationships") return text("connection, communication, boundaries, and observable relationship dynamics", "kết nối, giao tiếp, ranh giới và những động lực có thể quan sát trong mối quan hệ");
  if (slug === "business" || slug === "planning") return text("work, resources, decisions, and the next practical step", "công việc, nguồn lực, quyết định và bước thực tế tiếp theo");
  if (slug === "self-care") return text("needs, boundaries, renewal, and self-understanding", "nhu cầu, ranh giới, hồi phục và sự hiểu mình");
  if (slug === "creativity") return text("creative energy, blocks, collaboration, and expression", "năng lượng sáng tạo, điểm bế tắc, hợp tác và cách thể hiện");
  if (slug === "moon-phase") return text("cycles, release, renewal, and the stage of a process", "chu kỳ, buông bỏ, làm mới và giai đoạn của một tiến trình");
  if (slug === "fools-journey") return text("a chapter in transition, risk, learning, or a new direction", "một chương đang chuyển mình, rủi ro, bài học hoặc hướng đi mới");
  return text("a small situation that benefits from a clear, grounded reflection", "một tình huống nhỏ cần được nhìn lại một cách rõ ràng và thực tế");
}

function temporalFocus(strategy: TarotSpreadInterpretationStrategy, keys: string[]): LocalizedText | null {
  if (strategy !== "timeline") return null;
  const signature = keys.join(" ").toLocaleLowerCase();
  if (/yesterday|past|recent_past/.test(signature)) return text("past, present, and emerging direction", "quá khứ, hiện tại và hướng đang mở ra");
  if (/moon|release|building|blossom/.test(signature)) return text("the phase and movement of a cycle", "giai đoạn và chuyển động của một chu kỳ");
  return text("how the current pattern is developing", "cách mô thức hiện tại đang phát triển");
}

function edge(
  from: string,
  to: string,
  en: string,
  vi: string,
): LocalizedRelationship {
  return { from, to, relation: text(en, vi) };
}

function relationshipsFor(input: TarotSpreadSemanticsInput, strategy: TarotSpreadInterpretationStrategy, positions: TarotSpreadSemanticsInput["positions"]): LocalizedRelationship[] {
  const keys = new Set(positions.map((position) => position.key));
  const add = (items: LocalizedRelationship[]) => items.filter((item) => item.from !== item.to && keys.has(item.from) && keys.has(item.to)).slice(0, 8);
  if (strategy === "branching") {
    const branching = [
      edge("if_yes", "yes_leads_to", "the consequence of this choice", "điều lựa chọn này có thể dẫn đến"),
      edge("if_no", "no_leads_to", "the consequence of this choice", "điều lựa chọn này có thể dẫn đến"),
      edge("safe", "wild", "contrast the two kinds of risk", "đặt hai kiểu rủi ro cạnh nhau"),
      edge("stay", "go", "compare the cost and value of each path", "so sánh cái giá và giá trị của mỗi hướng đi"),
    ];
    const result = add(branching);
    if (result.length) return result;
  }
  if (strategy === "tension-resolution") {
    const tension = [
      edge("your_energy", "conflicting_energy", "the tension between the two forces", "điểm căng giữa hai luồng năng lượng"),
      edge("conflicting_energy", "bridge", "the bridge responds to the conflict", "cây cầu đáp lại điểm xung đột"),
      edge("bridge", "path", "the bridge opens a possible path", "cây cầu mở ra một hướng đi có thể thử"),
      edge("root_issue", "resolve", "the response meets the root issue", "cách xử lý chạm vào gốc rễ vấn đề"),
      edge("obstacle", "solution", "the response works with the obstacle", "hướng giải quyết làm việc cùng trở ngại"),
      edge("blocker", "path_through", "the path responds to the blocker", "con đường đi qua đáp lại điểm cản"),
    ];
    const result = add(tension);
    if (result.length) return result;
  }

  const ordered = [...positions].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  const relation = strategy === "contrast"
    ? ["compare these two positions", "đặt hai vị trí này cạnh nhau"] as const
    : strategy === "timeline"
      ? ["shows how this part develops into the next", "cho thấy phần này phát triển thành phần tiếp theo như thế nào"] as const
      : strategy === "system"
        ? ["adds another angle to the whole situation", "bổ sung một góc nhìn cho toàn bộ tình huống"] as const
        : ["sets up the next position", "làm nền cho vị trí tiếp theo"] as const;
  return add(ordered.slice(0, -1).map((position, index) => edge(position.key, ordered[index + 1].key, relation[0], relation[1])));
}

export function deriveTarotSpreadSemantics(input: TarotSpreadSemanticsInput): TarotSpreadSemanticsSeed {
  const positions = [...input.positions].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  const keys = positions.map((position) => position.key);
  const strategy = strategyFor(input, keys);
  const suitable = categoryQuestion(input);
  const strategySuitable = strategyQuestion(strategy);
  const first = positions[0];
  const last = positions[positions.length - 1] || first;
  const purpose = text(
    `${input.template.name.en} helps examine ${categoryQuestion(input).en} through ${input.categoryDescription.en.toLocaleLowerCase()}`,
    `${input.template.name.vi} giúp nhìn vào ${categoryQuestion(input).vi} qua ${input.categoryDescription.vi.toLocaleLowerCase()}`,
  );
  return {
    purpose,
    questionSuitability: [suitable, strategySuitable],
    interpretationStrategy: strategy,
    temporalFocus: temporalFocus(strategy, keys),
    interpretationEmphasis: [
      text(`${first.label.en} establishes the starting context.`, `Vị trí ${first.label.vi} đặt bối cảnh ban đầu.`),
      text(`${last.label.en} helps ground the synthesis in a direction or response.`, `Vị trí ${last.label.vi} giúp neo phần tổng hợp vào một hướng hoặc cách đáp lại.`),
    ],
    synthesisGuidance: strategyCopy(strategy),
    positionRelationships: relationshipsFor(input, strategy, positions),
  };
}

export function localizeTarotSpreadSemantics(seed: TarotSpreadSemanticsSeed, locale: TarotLocale): TarotSpreadSemantics {
  return {
    purpose: localized(seed.purpose, locale),
    questionSuitability: seed.questionSuitability.map((item) => localized(item, locale)),
    interpretationStrategy: seed.interpretationStrategy,
    temporalFocus: seed.temporalFocus ? localized(seed.temporalFocus, locale) : null,
    interpretationEmphasis: seed.interpretationEmphasis.map((item) => localized(item, locale)),
    synthesisGuidance: localized(seed.synthesisGuidance, locale),
    positionRelationships: seed.positionRelationships.map((relationship) => ({
      from: relationship.from,
      to: relationship.to,
      relation: localized(relationship.relation, locale),
    })),
  };
}

export function localizedTarotSpreadSemantics(
  input: LocalizedTarotSpreadSemanticsInput,
  locale: TarotLocale,
): TarotSpreadSemantics {
  const localizedValue = (value: string): LocalizedText => ({ en: value, vi: value });
  return localizeTarotSpreadSemantics(deriveTarotSpreadSemantics({
    ...input,
    categoryName: localizedValue(input.categoryName),
    categoryDescription: localizedValue(input.categoryDescription),
    template: { ...input.template, name: localizedValue(input.template.name), description: localizedValue(input.template.description) },
    positions: input.positions.map((position) => ({ ...position, label: localizedValue(position.label), description: localizedValue(position.description) })),
  }), locale);
}
