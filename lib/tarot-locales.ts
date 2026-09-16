export type TarotMeaning = {
  keywords: string;
  upright: string;
  reversed: string;
};

type CardMeaningSource = {
  id: number;
  suit: string;
  keywords: string;
  upright: string;
  reversed: string;
};

const majorMeaningsVi: Record<number, TarotMeaning> = {
  0: {
    keywords: "khởi đầu · cởi mở · khả năng",
    upright: "Hãy bước một bước nhỏ vào vùng chưa biết. Sự tò mò có thể hữu ích hơn việc phải có mọi câu trả lời.",
    reversed: "Tạm dừng trước một cú nhảy. Hãy nhận ra nỗi sợ hay sự bốc đồng đang chi phối quyết định.",
  },
  1: {
    keywords: "chủ động · kỹ năng · tháo vát",
    upright: "Hãy tập trung vào điều bạn có thể làm với những công cụ đang sẵn có. Một hành động rõ ràng sẽ tạo đà.",
    reversed: "Ý định đang bị phân tán có thể cần một kế hoạch rõ hơn. Hãy để lời nói và việc làm cùng hướng.",
  },
  2: {
    keywords: "trực giác · tĩnh lặng · bí ẩn",
    upright: "Hãy dành chỗ cho thông tin lặng im bên dưới những ồn ào. Bạn chưa cần tiết lộ mọi điều.",
    reversed: "Hãy chậm lại và kết nối với hiểu biết bên trong, thay vì mãi tìm kiếm câu trả lời từ bên ngoài.",
  },
  3: {
    keywords: "nuôi dưỡng · sáng tạo · sung túc",
    upright: "Hãy cho một ý tưởng hoặc mối quan hệ không gian để lớn lên. Quan tâm cũng bao gồm chăm sóc chính mình.",
    reversed: "Hãy nhận ra nơi việc cho đi đã trở thành cạn kiệt. Công việc sáng tạo có thể cần nghỉ ngơi và kỳ vọng nhẹ nhàng hơn.",
  },
  4: {
    keywords: "cấu trúc · ranh giới · lãnh đạo",
    upright: "Một ranh giới rõ ràng hoặc cấu trúc thực tế có thể nâng đỡ điều quan trọng với bạn.",
    reversed: "Sự kiểm soát cứng nhắc có thể đang giới hạn lựa chọn. Hãy tìm sự vững vàng mà không áp đặt.",
  },
  5: {
    keywords: "truyền thống · học hỏi · cộng đồng",
    upright: "Hãy cân nhắc điều một người thầy, truyền thống hoặc thực hành chung có thể mang lại cho bạn.",
    reversed: "Hãy chất vấn những luật lệ được thừa hưởng và chọn những giá trị bạn muốn tự mình thực hành.",
  },
  6: {
    keywords: "kết nối · lựa chọn · đồng điệu",
    upright: "Hãy lựa chọn phù hợp với các giá trị của bạn. Giao tiếp thành thật mở đường cho kết nối.",
    reversed: "Sự lệch nhau về ưu tiên cần được chú ý. Hãy lắng nghe kỹ trước khi cam kết.",
  },
  7: {
    keywords: "định hướng · ý chí · đà tiến",
    upright: "Hãy đưa những thôi thúc đối nghịch về một hướng đã chọn. Tiến bộ cần cả tập trung lẫn cân bằng.",
    reversed: "Cố ép mọi thứ chuyển động có thể khiến bạn kiệt sức. Hãy xem lại hướng đi trước khi tăng tốc.",
  },
  8: {
    keywords: "dũng khí · kiên nhẫn · lòng trắc ẩn",
    upright: "Hãy đón nhận một cảm xúc khó khăn bằng sự kiên nhẫn. Dũng khí thầm lặng vẫn là dũng khí.",
    reversed: "Hãy dịu dàng với phần mong manh trong bạn. Tự tin có thể trở lại qua những chăm sóc nhỏ mỗi ngày.",
  },
  9: {
    keywords: "chiêm nghiệm · một mình · sáng tỏ",
    upright: "Hãy lùi lại để nghe rõ suy nghĩ của mình. Khoảng lặng có thể làm bước tiếp theo sáng hơn.",
    reversed: "Hãy nhận ra khi ở một mình đã trở thành cô lập. Bạn có thể vừa tìm hỗ trợ vừa chiêm nghiệm.",
  },
  10: {
    keywords: "chu kỳ · thay đổi · thời điểm",
    upright: "Cuộc sống đang đi qua một chu kỳ thay đổi. Hãy đáp lại những điều nằm trong tầm ảnh hưởng của bạn.",
    reversed: "Một khuôn mẫu lặp lại đang mời bạn phản hồi khác đi. Bất định không lấy đi quyền chủ động của bạn.",
  },
  11: {
    keywords: "trách nhiệm · công bằng · rõ ràng",
    upright: "Hãy xem xét sự thật và phần trách nhiệm của bạn trong tình huống này. Chọn việc bạn có thể chịu trách nhiệm.",
    reversed: "Hãy tìm thiên kiến, né tránh hoặc mất cân bằng. Một lần đánh giá trung thực có thể đang cần thiết.",
  },
  12: {
    keywords: "góc nhìn · tạm dừng · buông bỏ",
    upright: "Một khoảng dừng có thể hé lộ góc nhìn mà nỗ lực đơn thuần không đem lại. Hãy để câu hỏi có thời gian thở.",
    reversed: "Hãy hỏi liệu chờ đợi đang đem lại sự thấu hiểu hay chỉ trì hoãn một bước cần thiết.",
  },
  13: {
    keywords: "chuyển tiếp · buông bỏ · tái sinh",
    upright: "Một kết thúc có thể mở chỗ cho khởi đầu khác. Hãy để một chương đã cũ khép lại.",
    reversed: "Bám vào khuôn mẫu quen thuộc có thể đang trì hoãn thay đổi. Bạn có thể buông bỏ từng chút một.",
  },
  14: {
    keywords: "cân bằng · hòa hợp · kiên nhẫn",
    upright: "Hãy thử một điểm cân bằng bền vững. Những điều chỉnh nhỏ tạo nên sự hài hòa theo thời gian.",
    reversed: "Hãy nhận ra các cực đoan và khôi phục một nhịp điệu có thể duy trì. Hòa hợp không phải lúc nào cũng cần vội.",
  },
  15: {
    keywords: "ràng buộc · thói quen · giới hạn",
    upright: "Hãy gọi tên một khuôn mẫu khiến bạn mắc kẹt. Nhìn thấy nó đã là một bước để có thêm lựa chọn.",
    reversed: "Bạn có thể đã sẵn sàng nới lỏng một gắn bó không lành mạnh. Hãy chọn sự hỗ trợ và ranh giới thực tế.",
  },
  16: {
    keywords: "xáo trộn · nhận ra · xây dựng lại",
    upright: "Một sự thật bất ngờ có thể làm rung chuyển cấu trúc cũ. Hãy tập trung vào điều có thể xây lại một cách thành thật.",
    reversed: "Một thay đổi bạn cảm nhận có thể khó đối diện. Hãy xử lý nền móng yếu từng phần một.",
  },
  17: {
    keywords: "hy vọng · hồi phục · cởi mở",
    upright: "Hãy kết nối lại với điều khôi phục niềm tin của bạn. Một nguồn hy vọng nhỏ cũng đáng được chú ý.",
    reversed: "Khi cảm hứng ở xa, hãy quay về những thực hành đơn giản giúp bạn được nạp lại.",
  },
  18: {
    keywords: "bất định · tưởng tượng · bản năng",
    upright: "Hãy đi chậm khi mọi thứ chưa rõ. Tách điều quan sát được khỏi nỗi sợ và giả định.",
    reversed: "Một cảm giác rối bời có thể đang lắng xuống. Hãy để sự sáng tỏ đến trước khi kết luận.",
  },
  19: {
    keywords: "niềm vui · sáng rõ · sinh lực",
    upright: "Hãy để ý điều đem lại hơi ấm và sự giản dị. Cho phép mình trân trọng một khoảnh khắc đáng khích lệ.",
    reversed: "Niềm vui có thể lặng hơn bạn mong đợi. Hãy buông áp lực phải thấy mọi thứ hoàn hảo.",
  },
  20: {
    keywords: "chiêm nghiệm · thức tỉnh · hồi đáp",
    upright: "Hãy nhìn lại điều đã học và đáp lời bằng một hành động khác đi.",
    reversed: "Tự phê bình có thể che khuất nhận thức hữu ích. Hãy nhìn lại quá khứ mà không biến nó thành phán quyết.",
  },
  21: {
    keywords: "hoàn tất · hòa nhập · trọn vẹn",
    upright: "Hãy ghi nhận chặng đường đã đi qua. Hoàn tất một chu kỳ trước khi bước vào chu kỳ kế tiếp.",
    reversed: "Một chi tiết còn dang dở có thể cần được chăm chút. Hãy xác định thế nào là đủ cho chương này.",
  },
};

const minorThemesVi: Record<string, string[]> = {
  Wands: [
    "tia sáng sáng tạo mới",
    "lập kế hoạch và mở rộng tầm nhìn",
    "mở rộng và nhìn về phía trước",
    "ăn mừng và nền tảng vững vàng",
    "cạnh tranh và những hướng đi xung đột",
    "được ghi nhận và thành công chung",
    "bảo vệ lập trường của bạn",
    "chuyển động nhanh và giao tiếp",
    "kiên cường và gìn giữ năng lượng",
    "trách nhiệm và gánh quá nhiều",
    "tò mò và khám phá sáng tạo",
    "nhiệt huyết và hành động táo bạo",
    "tự tin và tinh thần cởi mở",
    "tầm nhìn và khả năng dẫn dắt có mục đích",
  ],
  Cups: [
    "cởi mở cảm xúc và một kết nối mới",
    "đồng hành và thấu hiểu lẫn nhau",
    "tình bạn và niềm vui sẻ chia",
    "rút lui và một cơ hội bị bỏ qua",
    "thất vọng và điều vẫn còn lại",
    "ký ức và sự thân thuộc dễ chịu",
    "nhiều lựa chọn và trí tưởng tượng",
    "rời khỏi điều không còn nuôi dưỡng bạn",
    "mãn nguyện và lòng biết ơn",
    "cảm giác thuộc về và viên mãn cảm xúc",
    "sự nhạy cảm và một cảm xúc bất ngờ",
    "một lời mời từ trái tim",
    "lòng trắc ẩn và nhận biết cảm xúc",
    "sự vững vàng và đồng cảm về cảm xúc",
  ],
  Swords: [
    "một ý tưởng rõ ràng và nhận thức thành thật",
    "lựa chọn khó khăn và bế tắc tinh thần",
    "nỗi đau và một sự thật không dễ chịu",
    "nghỉ ngơi và hồi phục sau nỗ lực",
    "xung đột và cái giá của chiến thắng",
    "chuyển tiếp về vùng nước yên hơn",
    "chiến lược và xem xét động cơ của bạn",
    "cảm giác bị giới hạn bởi một lối nghĩ",
    "lo âu và những suy nghĩ lặp lại",
    "một kết thúc và giới hạn của sức chịu đựng",
    "câu hỏi và sự quan sát tỉnh táo",
    "hành động trực diện và tư duy nhanh",
    "sự sáng suốt và ranh giới thành thật",
    "lý trí và phán đoán có trách nhiệm",
  ],
  Pentacles: [
    "một cơ hội thực tế",
    "cân bằng ưu tiên và thích nghi",
    "cộng tác và phát triển kỹ năng",
    "an toàn và giữ quá chặt",
    "thiếu thốn và nhu cầu được hỗ trợ",
    "cho đi và nhận lại công bằng",
    "kiên nhẫn và xem xét nỗ lực",
    "luyện tập và tiến bộ đều đặn",
    "độc lập và sự đủ đầy do mình tạo ra",
    "di sản và sự nâng đỡ lâu dài",
    "học hỏi và sự tò mò thực tế",
    "đáng tin cậy và nỗ lực nhất quán",
    "chăm sóc bằng sự thiết thực",
    "quản lý và khả năng lãnh đạo vững vàng",
  ],
};

function minorMeaning(card: CardMeaningSource): TarotMeaning | undefined {
  const themes = minorThemesVi[card.suit];
  if (!themes) return undefined;
  const index = (card.id - 22) % 14;
  const theme = themes[index];
  if (!theme) return undefined;
  return {
    keywords: theme,
    upright: `Lá bài này hướng sự chú ý đến ${theme}. Hãy xem chủ đề này xuất hiện ở đâu trong hoàn cảnh của bạn và bước tiếp theo sáng suốt nào đang mở ra.`,
    reversed: `Hãy nhìn sâu vào ${theme}. Năng lượng có thể đang bị chặn, đi quá mức hoặc cần được thể hiện theo một cách khác. Điều gì cần một cách tiếp cận nhẹ nhàng và cân bằng hơn?`,
  };
}

export function cardMeaning(card: CardMeaningSource, locale: "en" | "vi"): TarotMeaning {
  if (locale !== "vi") {
    return { keywords: card.keywords, upright: card.upright, reversed: card.reversed };
  }
  return majorMeaningsVi[card.id] ?? minorMeaning(card) ?? {
    keywords: card.keywords,
    upright: card.upright,
    reversed: card.reversed,
  };
}
