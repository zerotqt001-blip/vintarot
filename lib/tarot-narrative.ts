import { cardMeaning, type TarotMeaning } from "./tarot-locales";

export const narrativeSectionKeys = [
  "energy",
  "actions",
  "strengthsChallenges",
  "relationships",
  "work",
  "creativity",
  "home",
  "symbolism",
  "journalQuestions",
  "memes",
] as const;

export type NarrativeSectionKey = (typeof narrativeSectionKeys)[number];
export type NarrativeLocale = "en" | "vi";
export type NarrativeCard = {
  id: number;
  name: string;
  suit: string;
  keywords: string;
  upright: string;
  reversed: string;
};

export type TarotNarrativeSection = {
  key: NarrativeSectionKey;
  title: string;
  body: string;
};

export type TarotNarrative = {
  summary: string;
  sections: TarotNarrativeSection[];
};

const titles: Record<NarrativeLocale, Record<NarrativeSectionKey, string>> = {
  en: {
    energy: "Energy",
    actions: "Actions",
    strengthsChallenges: "Strengths & Challenges",
    relationships: "Relationships",
    work: "Work",
    creativity: "Creativity",
    home: "Home",
    symbolism: "Symbolism",
    journalQuestions: "Journal Questions",
    memes: "Memes",
  },
  vi: {
    energy: "Năng lượng",
    actions: "Hành động",
    strengthsChallenges: "Điểm mạnh & Thử thách",
    relationships: "Mối quan hệ",
    work: "Công việc",
    creativity: "Sáng tạo",
    home: "Gia đình",
    symbolism: "Biểu tượng",
    journalQuestions: "Câu hỏi nhật ký",
    memes: "Meme",
  },
};

const suitCopy: Record<
  string,
  {
    en: { current: string; relationships: string; work: string; creativity: string; home: string; symbol: string };
    vi: { current: string; relationships: string; work: string; creativity: string; home: string; symbol: string };
  }
> = {
  "Major Arcana": {
    en: {
      current: "the larger turning points of a life",
      relationships: "let the relationship teach you something honest about the chapter you are in",
      work: "make room for the long arc instead of measuring yourself by one result",
      creativity: "follow the image or idea that keeps returning, even if it changes your direction",
      home: "notice how your space reflects the season of life you are moving through",
      symbol: "a threshold: an old identity loosening so a wiser one can take shape",
    },
    vi: {
      current: "những bước ngoặt lớn trong đời",
      relationships: "để mối quan hệ cho bạn thấy một sự thật về chương đời hiện tại",
      work: "nhìn vào hành trình dài thay vì đo mình bằng một kết quả duy nhất",
      creativity: "đi theo hình ảnh hoặc ý tưởng cứ trở lại, kể cả khi nó đổi hướng",
      home: "nhận ra không gian sống đang phản chiếu giai đoạn bạn đi qua",
      symbol: "một ngưỡng cửa: bản dạng cũ đang nới lỏng để điều chín chắn hơn thành hình",
    },
  },
  Wands: {
    en: {
      current: "fire, desire, and creative momentum",
      relationships: "speak plainly about desire while leaving room for the other person’s pace",
      work: "protect the spark, then give it a deadline or a simple next milestone",
      creativity: "make before you judge; movement will reveal which idea has heat",
      home: "bring in light, color, or a small ritual that makes the room feel alive",
      symbol: "fire: the will to begin, grow, and risk being seen",
    },
    vi: {
      current: "lửa, ham muốn và đà sáng tạo",
      relationships: "nói rõ điều mình mong muốn nhưng vẫn tôn trọng nhịp độ của người kia",
      work: "giữ tia lửa rồi trao cho nó một hạn chót hoặc cột mốc nhỏ",
      creativity: "hãy làm trước khi phán xét; chuyển động sẽ cho thấy ý tưởng nào có nhiệt",
      home: "đưa thêm ánh sáng, màu sắc hoặc một nghi thức nhỏ để căn phòng có sức sống",
      symbol: "lửa: ý chí bắt đầu, lớn lên và dám để người khác nhìn thấy",
    },
  },
  Cups: {
    en: {
      current: "feeling, attachment, and the intelligence of the heart",
      relationships: "let tenderness be specific: name the feeling, need, or boundary that wants care",
      work: "notice which collaborations feel nourishing and which ones quietly drain your attention",
      creativity: "give the mood a container through music, color, movement, or a page of honest writing",
      home: "make one corner comfortable enough for your nervous system to soften",
      symbol: "water: emotion in motion, memory, intuition, and the need for a vessel",
    },
    vi: {
      current: "cảm xúc, gắn bó và sự sáng suốt của trái tim",
      relationships: "để sự dịu dàng trở nên cụ thể: gọi tên cảm xúc, nhu cầu hoặc ranh giới cần được chăm sóc",
      work: "nhận ra sự cộng tác nào nuôi dưỡng bạn và sự cộng tác nào âm thầm lấy đi sự tập trung",
      creativity: "cho tâm trạng một chiếc khuôn bằng âm nhạc, màu sắc, chuyển động hoặc vài dòng thật lòng",
      home: "tạo một góc đủ dễ chịu để hệ thần kinh của bạn được thả lỏng",
      symbol: "nước: cảm xúc luôn chuyển động, ký ức, trực giác và nhu cầu có một chiếc bình chứa",
    },
  },
  Swords: {
    en: {
      current: "thought, language, discernment, and the courage to name what is true",
      relationships: "choose clarity over guessing; a clean sentence can prevent a whole story of resentment",
      work: "separate the urgent from the important and document the decision that needs to be made",
      creativity: "edit with kindness. A sharper question often opens more possibilities than more effort",
      home: "clear one source of mental noise so your space can support rest and perspective",
      symbol: "air: the mind cutting through fog, with a reminder that every idea needs compassion",
    },
    vi: {
      current: "suy nghĩ, ngôn ngữ, sự sáng suốt và dũng khí gọi tên sự thật",
      relationships: "chọn sự rõ ràng thay vì đoán ý; một câu nói sạch có thể ngăn cả chuỗi oán giận",
      work: "tách điều khẩn cấp khỏi điều quan trọng và ghi lại quyết định cần được đưa ra",
      creativity: "biên tập bằng lòng tử tế. Một câu hỏi sắc hơn thường mở ra nhiều khả năng hơn là cố thêm",
      home: "dọn một nguồn gây ồn trong đầu để không gian nâng đỡ việc nghỉ ngơi và nhìn lại",
      symbol: "không khí: trí óc xuyên qua màn sương, cùng lời nhắc rằng ý tưởng nào cũng cần lòng trắc ẩn",
    },
  },
  Pentacles: {
    en: {
      current: "body, resources, skill, and the patient work of making something real",
      relationships: "show care through consistency, practical help, and agreements you can actually keep",
      work: "choose the repeatable process over the impressive shortcut; craft compounds quietly",
      creativity: "let your hands lead: prototype, cook, build, draw, or practice until the idea has weight",
      home: "tend to one physical detail that makes daily life safer, calmer, or more spacious",
      symbol: "earth: a grounded promise that attention becomes value when it is practiced over time",
    },
    vi: {
      current: "cơ thể, nguồn lực, kỹ năng và công việc kiên nhẫn biến điều gì đó thành thật",
      relationships: "thể hiện sự quan tâm bằng tính nhất quán, trợ giúp thiết thực và thỏa thuận bạn có thể giữ",
      work: "chọn quy trình lặp lại được thay vì lối tắt hào nhoáng; tay nghề âm thầm cộng dồn",
      creativity: "để đôi tay dẫn đường: thử mẫu, nấu, dựng, vẽ hoặc luyện tập đến khi ý tưởng có trọng lượng",
      home: "chăm một chi tiết vật chất giúp đời sống hằng ngày an toàn, yên hơn hoặc rộng rãi hơn",
      symbol: "đất: lời hứa vững vàng rằng sự chú tâm sẽ thành giá trị khi được thực hành theo thời gian",
    },
  },
};

const majorThemes: Record<string, { en: string; vi: string }> = {
  "The Fool": { en: "a leap toward a new chapter", vi: "một bước nhảy vào chương mới" },
  "The Magician": { en: "turning intention into action", vi: "biến ý định thành hành động" },
  "The High Priestess": { en: "quiet knowledge beneath the noise", vi: "tri thức lặng im bên dưới ồn ào" },
  "The Empress": { en: "the conditions that let life grow", vi: "những điều kiện giúp sự sống lớn lên" },
  "The Emperor": { en: "structure that protects what matters", vi: "cấu trúc bảo vệ điều quan trọng" },
  "The Hierophant": { en: "learning through a living tradition", vi: "học hỏi qua một truyền thống đang sống" },
  "The Lovers": { en: "a choice that brings values into alignment", vi: "một lựa chọn đưa các giá trị về cùng hướng" },
  "The Chariot": { en: "focused movement through competing pulls", vi: "chuyển động tập trung giữa những lực kéo đối nghịch" },
  Strength: { en: "patient courage and a softer kind of power", vi: "dũng khí kiên nhẫn và một kiểu sức mạnh dịu hơn" },
  "The Hermit": { en: "the insight found in deliberate quiet", vi: "sự sáng tỏ tìm thấy trong khoảng lặng có chủ ý" },
  "Wheel of Fortune": { en: "a cycle turning beyond your control", vi: "một chu kỳ đang xoay ngoài tầm kiểm soát" },
  Justice: { en: "an honest reckoning with cause and effect", vi: "một lần nhìn thẳng vào nguyên nhân và hệ quả" },
  "The Hanged Man": { en: "a pause that changes the angle of the question", vi: "một khoảng dừng đổi góc nhìn của câu hỏi" },
  Death: { en: "release that makes renewal possible", vi: "sự buông bỏ mở đường cho tái sinh" },
  Temperance: { en: "a sustainable rhythm between extremes", vi: "nhịp điệu bền vững giữa những cực đoan" },
  "The Devil": { en: "the freedom hidden inside a named pattern", vi: "tự do ẩn bên trong một khuôn mẫu được gọi tên" },
  "The Tower": { en: "truth that clears an unstable foundation", vi: "sự thật dọn sạch một nền móng lung lay" },
  "The Star": { en: "a small, steady return of hope", vi: "hy vọng nhỏ bé nhưng bền bỉ trở lại" },
  "The Moon": { en: "instinct moving through uncertainty", vi: "bản năng đi qua vùng chưa rõ" },
  "The Sun": { en: "warmth, visibility, and uncomplicated joy", vi: "hơi ấm, sự sáng rõ và niềm vui giản dị" },
  Judgement: { en: "a call to answer what you now know", vi: "lời gọi hồi đáp điều bạn đã hiểu" },
  "The World": { en: "completion that can be carried forward", vi: "sự hoàn tất có thể mang theo về phía trước" },
};

const rankThemes: Record<string, { en: string; vi: string }> = {
  Ace: { en: "a first spark", vi: "tia lửa đầu tiên" },
  Two: { en: "balance and a meaningful choice", vi: "sự cân bằng và một lựa chọn có ý nghĩa" },
  Three: { en: "growth through exchange", vi: "lớn lên qua sự trao đổi" },
  Four: { en: "a pause that reveals what is secure", vi: "khoảng dừng cho thấy điều gì đang vững" },
  Five: { en: "friction that asks for a wiser response", vi: "ma sát cần một cách hồi đáp khôn ngoan hơn" },
  Six: { en: "movement, memory, or recognition", vi: "chuyển động, ký ức hoặc sự ghi nhận" },
  Seven: { en: "a test of conviction", vi: "một phép thử cho niềm tin" },
  Eight: { en: "momentum and a change of pace", vi: "đà tiến và sự đổi nhịp" },
  Nine: { en: "resilience at the edge of enough", vi: "sự bền bỉ bên rìa của chữ đủ" },
  Ten: { en: "the weight or harvest of a whole cycle", vi: "sức nặng hoặc mùa gặt của cả một chu kỳ" },
  Page: { en: "curiosity learning how to speak", vi: "sự tò mò đang học cách cất lời" },
  Knight: { en: "movement with a distinct style", vi: "chuyển động mang một phong cách riêng" },
  Queen: { en: "mature inner authority", vi: "uy tín nội tâm đã chín" },
  King: { en: "responsible mastery", vi: "sự làm chủ có trách nhiệm" },
};

const suitNamesVi: Record<string, string> = {
  "Major Arcana": "Ẩn chính",
  Wands: "Gậy",
  Cups: "Cốc",
  Swords: "Kiếm",
  Pentacles: "Tiền",
};

const stageText: Record<NarrativeLocale, { opening: string; invitation: string; question: string }> = {
  en: {
    opening: "This card opens a door",
    invitation: "It invites you to stay close to what is happening rather than forcing a final answer.",
    question: "What would become possible if you let this theme be a practice instead of a verdict?",
  },
  vi: {
    opening: "Lá bài này mở một cánh cửa",
    invitation: "Nó mời bạn ở gần điều đang diễn ra thay vì ép mình phải có câu trả lời cuối cùng.",
    question: "Điều gì sẽ mở ra nếu bạn xem chủ đề này là một thực hành thay vì một phán quyết?",
  },
};

const foolNarrative: Record<NarrativeLocale, TarotNarrative> = {
  en: {
    summary: "A bright, untamed beginning: the old chapter is closing, and the next one does not need a map before it can start.",
    sections: [
      { key: "energy", title: titles.en.energy, body: "The Fool carries the fizzy feeling of standing at an edge with your bag half-packed. Curiosity is louder than certainty, and that is useful here: your body already knows which direction feels alive. Let the excitement be information without asking it to promise a perfect outcome." },
      { key: "actions", title: titles.en.actions, body: "Take the first ordinary step. Send the message, book the appointment, open the blank document, or walk the unfamiliar route. You can learn the rest after you begin; momentum is allowed to be your teacher." },
      { key: "strengthsChallenges", title: titles.en.strengthsChallenges, body: "Your willingness to begin gives you access to doors that cautious people never approach. The challenge is mistaking optimism for preparation, or treating every warning as a reason to freeze. Pack one useful thing, check the ground, then trust yourself to adapt." },
      { key: "relationships", title: titles.en.relationships, body: "Bring freshness into connection by saying what you actually want to discover together. A new relationship may need room to be undefined for a while; an old one may need a playful reset. Keep your freedom and your promises in the same conversation." },
      { key: "work", title: titles.en.work, body: "A new role, pitch, class, or experiment can be worth trying before you know its whole shape. Let a small prototype answer the questions that planning cannot. Guard against rushing past practical details simply because the idea feels exciting." },
      { key: "creativity", title: titles.en.creativity, body: "Make the strange first draft. Follow the color, rhythm, or image that has not yet learned how to explain itself. The Fool’s gift is permission to play long enough for a real voice to appear." },
      { key: "home", title: titles.en.home, body: "Refresh one corner of your space so it can welcome the person you are becoming. A packed bag, an open window, or a cleared table can make a beginning feel tangible. Keep what supports movement and release what belongs to the old chapter." },
      { key: "symbolism", title: titles.en.symbolism, body: "The cliff is the meeting point of risk and possibility; the small companion is instinct reminding you to stay awake. The bright sky suggests that uncertainty is not the same as danger. Read the card as a threshold, not a command to ignore consequences." },
      { key: "journalQuestions", title: titles.en.journalQuestions, body: "Where are you asking for certainty when a first experiment would teach you more? What would you carry into the next chapter, and what can stay behind? Name one gentle risk that your future self would thank you for taking." },
      { key: "memes", title: titles.en.memes, body: "Meme energy: “I have no idea what I’m doing” — somehow arrives with snacks, a brilliant story, and exactly the right amount of nerve." },
    ],
  },
  vi: {
    summary: "Một khởi đầu sáng và tự do: chương cũ đang khép lại, còn chương mới không cần có bản đồ hoàn chỉnh mới có thể bắt đầu.",
    sections: [
      { key: "energy", title: titles.vi.energy, body: "Lá Gã Khờ mang theo cảm giác lâng lâng khi đứng ở rìa một điều mới, hành lý đã chuẩn bị một nửa. Sự tò mò đang lớn hơn sự chắc chắn, và đó là tín hiệu hữu ích: cơ thể bạn đã biết hướng nào khiến mình thấy sống động. Hãy để phấn khích là thông tin, đừng bắt nó hứa về một kết quả hoàn hảo." },
      { key: "actions", title: titles.vi.actions, body: "Hãy làm bước bình thường đầu tiên. Gửi tin nhắn, đặt lịch, mở trang giấy trắng hoặc đi một con đường lạ. Bạn có thể học phần còn lại sau khi bắt đầu; đà tiến cũng được phép làm người thầy của bạn." },
      { key: "strengthsChallenges", title: titles.vi.strengthsChallenges, body: "Sự sẵn lòng bắt đầu giúp bạn chạm tới những cánh cửa mà người quá thận trọng không bao giờ đến gần. Thử thách là nhầm lẫn lạc quan với chuẩn bị, hoặc xem mọi lời cảnh báo như lý do để đứng yên. Hãy mang theo một điều hữu ích, nhìn mặt đất rồi tin rằng mình có thể thích nghi." },
      { key: "relationships", title: titles.vi.relationships, body: "Hãy đem sự tươi mới vào mối quan hệ bằng cách nói thật điều bạn muốn cùng khám phá. Một kết nối mới cần khoảng trống để chưa phải định nghĩa ngay; kết nối cũ có thể cần một khởi động vui hơn. Giữ tự do và lời hứa trong cùng một cuộc trò chuyện." },
      { key: "work", title: titles.vi.work, body: "Một vai trò, đề xuất, lớp học hoặc thử nghiệm mới có thể đáng thử trước khi bạn biết hết hình dáng của nó. Hãy để một nguyên mẫu nhỏ trả lời những câu hỏi mà việc lập kế hoạch chưa thể trả lời. Đừng bỏ qua chi tiết thực tế chỉ vì ý tưởng đang làm bạn phấn khích." },
      { key: "creativity", title: titles.vi.creativity, body: "Hãy tạo bản nháp kỳ lạ đầu tiên. Đi theo màu sắc, nhịp điệu hoặc hình ảnh chưa biết cách tự giải thích. Món quà của Gã Khờ là cho phép mình chơi đủ lâu để một giọng nói thật sự xuất hiện." },
      { key: "home", title: titles.vi.home, body: "Làm mới một góc nhỏ để không gian chào đón con người bạn đang trở thành. Một chiếc túi đã sắp, ô cửa mở hoặc chiếc bàn được dọn có thể khiến khởi đầu trở nên hữu hình. Giữ điều nâng đỡ chuyển động và buông thứ thuộc về chương cũ." },
      { key: "symbolism", title: titles.vi.symbolism, body: "Vách đá là nơi rủi ro gặp khả năng; người bạn nhỏ bên cạnh nhắc trực giác hãy tỉnh thức. Bầu trời sáng cho thấy bất định không đồng nghĩa với nguy hiểm. Hãy đọc lá bài như một ngưỡng cửa, không phải mệnh lệnh bỏ qua hệ quả." },
      { key: "journalQuestions", title: titles.vi.journalQuestions, body: "Bạn đang đòi hỏi sự chắc chắn ở đâu trong khi một thử nghiệm đầu tiên sẽ dạy bạn nhiều hơn? Bạn muốn mang điều gì vào chương mới, và điều gì có thể để lại phía sau? Hãy gọi tên một rủi ro dịu dàng mà phiên bản tương lai sẽ cảm ơn bạn đã chọn." },
      { key: "memes", title: titles.vi.memes, body: "Năng lượng meme: “Tôi chẳng biết mình đang làm gì” — vậy mà vẫn đến nơi với đồ ăn nhẹ, một câu chuyện hay và lượng can đảm vừa đủ." },
    ],
  },
};

function minorRank(name: string): string {
  return name.split(" of ")[0] || "Ace";
}

function suitInfo(card: NarrativeCard, locale: NarrativeLocale) {
  return suitCopy[card.suit]?.[locale] ?? suitCopy["Major Arcana"][locale];
}

function themeFor(card: NarrativeCard, locale: NarrativeLocale): string {
  if (card.suit === "Major Arcana") return majorThemes[card.name]?.[locale] ?? stageText[locale].opening.toLowerCase();
  return rankThemes[minorRank(card.name)]?.[locale] ?? stageText[locale].opening.toLowerCase();
}

function cardNarrativeTemplate(card: NarrativeCard, locale: NarrativeLocale, meaning: TarotMeaning): TarotNarrative {
  const copy = suitInfo(card, locale);
  const theme = themeFor(card, locale);
  const keywords = meaning.keywords;
  const firstUpright = meaning.upright.split(".")[0].trim();
  const firstReversed = meaning.reversed.split(".")[0].trim();
  const rank = locale === "en" ? (rankThemes[minorRank(card.name)]?.en ?? "a new stage") : (rankThemes[minorRank(card.name)]?.vi ?? "một giai đoạn mới");
  const isEnglish = locale === "en";
  const summary = isEnglish
    ? `${stageText.en.opening} around ${theme}. It carries ${keywords} into ${copy.current}, asking you to move with attention while the story is still taking shape.`
    : `${stageText.vi.opening} xoay quanh ${theme}. Nó đưa ${keywords} vào ${copy.current}, mời bạn bước đi tỉnh thức khi câu chuyện vẫn đang thành hình.`;
  const sections: TarotNarrativeSection[] = isEnglish
    ? [
        { key: "energy", title: titles.en.energy, body: `${card.name} carries ${keywords}. ${meaning.upright} ${stageText.en.invitation}` },
        { key: "actions", title: titles.en.actions, body: `Give ${theme} a practical direction: ${firstUpright.toLowerCase()}. Choose one step you can repeat this week, then let the result tell you what needs to change.` },
        { key: "strengthsChallenges", title: titles.en.strengthsChallenges, body: `The strength here is the ability to work with ${rank} without losing your center. The challenge is ${firstReversed.toLowerCase()}. Hold both truths gently; discernment grows when you stop treating a lesson as a failure.` },
        { key: "relationships", title: titles.en.relationships, body: `In relationships, ${copy.relationships}. Ask for the kind of honesty that makes room for both people, and notice whether your choices are building trust or only avoiding discomfort.` },
        { key: "work", title: titles.en.work, body: `At work, ${copy.work}. Define the smallest useful deliverable, make the hidden assumption visible, and let steady feedback replace the pressure to know everything at once.` },
        { key: "creativity", title: titles.en.creativity, body: `For creative practice, ${copy.creativity}. Give yourself a time-boxed experiment and keep the part that still feels alive after the first edit.` },
        { key: "home", title: titles.en.home, body: `At home, ${copy.home}. A simple change in your surroundings can help ${theme} become something you can feel, not just something you think about.` },
        { key: "symbolism", title: titles.en.symbolism, body: `The ${card.suit} current points to ${copy.symbol}. The repeated image of ${keywords.split(" · ")[0]} is a mirror: it shows where attention is ready to become a choice.` },
        { key: "journalQuestions", title: titles.en.journalQuestions, body: `${stageText.en.question} Where do you notice ${keywords} in your body, calendar, or conversations? What would a kind next step look like if it did not need to prove anything?` },
        { key: "memes", title: titles.en.memes, body: `Meme energy: “${firstUpright}” — with just enough self-awareness to laugh, reset, and try again.` },
      ]
    : [
        { key: "energy", title: titles.vi.energy, body: `Lá bài này mang năng lượng ${keywords}. ${meaning.upright} ${stageText.vi.invitation}` },
        { key: "actions", title: titles.vi.actions, body: `Hãy trao cho ${theme} một hướng đi thực tế: ${firstUpright.toLowerCase()}. Chọn một bước có thể lặp lại trong tuần này, rồi để kết quả cho bạn biết điều gì cần đổi.` },
        { key: "strengthsChallenges", title: titles.vi.strengthsChallenges, body: `Điểm mạnh ở đây là khả năng đi qua ${rank} mà vẫn giữ được trung tâm. Thử thách là ${firstReversed.toLowerCase()}. Hãy giữ cả hai sự thật bằng lòng dịu dàng; sự sáng suốt lớn lên khi bài học không còn bị xem là thất bại.` },
        { key: "relationships", title: titles.vi.relationships, body: `Trong các mối quan hệ, ${copy.relationships}. Hãy tìm kiểu thành thật tạo chỗ cho cả hai người và để ý xem lựa chọn của bạn đang xây niềm tin hay chỉ né sự khó chịu.` },
        { key: "work", title: titles.vi.work, body: `Trong công việc, ${copy.work}. Xác định kết quả hữu ích nhỏ nhất, làm rõ giả định đang ẩn và để phản hồi đều đặn thay thế áp lực phải biết mọi thứ ngay lập tức.` },
        { key: "creativity", title: titles.vi.creativity, body: `Với thực hành sáng tạo, ${copy.creativity}. Hãy đặt thời lượng cho một thử nghiệm và giữ lại phần vẫn còn sức sống sau lần chỉnh sửa đầu tiên.` },
        { key: "home", title: titles.vi.home, body: `Ở nhà, ${copy.home}. Một thay đổi giản dị trong môi trường có thể giúp ${theme} trở thành điều bạn cảm nhận được, không chỉ là điều bạn nghĩ về.` },
        { key: "symbolism", title: titles.vi.symbolism, body: `Dòng chảy ${suitNamesVi[card.suit] ?? card.suit} gợi về ${copy.symbol}. Hình ảnh lặp lại của ${keywords.split(" · ")[0]} là một tấm gương: nó cho thấy nơi sự chú tâm đã sẵn sàng trở thành lựa chọn.` },
        { key: "journalQuestions", title: titles.vi.journalQuestions, body: `${stageText.vi.question} Bạn nhận ra ${keywords} ở đâu trong cơ thể, lịch trình hoặc những cuộc trò chuyện? Bước tiếp theo tử tế sẽ trông như thế nào nếu nó không cần chứng minh điều gì?` },
        { key: "memes", title: titles.vi.memes, body: `Năng lượng meme: “${firstUpright}” — đủ tự nhận biết để bật cười, chỉnh lại và thử thêm lần nữa.` },
      ];
  return { summary, sections };
}

export function cardNarrative(card: NarrativeCard, locale: NarrativeLocale): TarotNarrative {
  const meaning = cardMeaning(card, locale);
  if (card.name === "The Fool") return foolNarrative[locale];
  return cardNarrativeTemplate(card, locale, meaning);
}
