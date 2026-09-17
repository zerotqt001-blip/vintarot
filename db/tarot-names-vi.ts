const majorNames: Record<string, string> = {
  "The Fool": "Kẻ Khờ",
  "The Magician": "Nhà Ảo Thuật",
  "The High Priestess": "Nữ Tư Tế",
  "The Empress": "Hoàng Hậu",
  "The Emperor": "Hoàng Đế",
  "The Hierophant": "Giáo Hoàng",
  "The Lovers": "Người Tình",
  "The Chariot": "Cỗ Xe",
  Strength: "Sức Mạnh",
  "The Hermit": "Ẩn Sĩ",
  "Wheel of Fortune": "Bánh Xe Số Phận",
  Justice: "Công Lý",
  "The Hanged Man": "Người Treo Ngược",
  Death: "Cái Chết",
  Temperance: "Tiết Chế",
  "The Devil": "Quỷ",
  "The Tower": "Tòa Tháp",
  "The Star": "Ngôi Sao",
  "The Moon": "Mặt Trăng",
  "The Sun": "Mặt Trời",
  Judgement: "Phán Xét",
  "The World": "Thế Giới",
};

const ranks: Array<[string, string]> = [
  ["Ace", "Át"],
  ["Two", "Hai"],
  ["Three", "Ba"],
  ["Four", "Bốn"],
  ["Five", "Năm"],
  ["Six", "Sáu"],
  ["Seven", "Bảy"],
  ["Eight", "Tám"],
  ["Nine", "Chín"],
  ["Ten", "Mười"],
  ["Page", "Tiểu Đồng"],
  ["Knight", "Kỵ Sĩ"],
  ["Queen", "Nữ Hoàng"],
  ["King", "Vua"],
];

const suits: Array<[string, string]> = [
  ["Wands", "Gậy"],
  ["Cups", "Cốc"],
  ["Swords", "Kiếm"],
  ["Pentacles", "Tiền"],
];

const minorNames = Object.fromEntries(
  suits.flatMap(([suitEn, suitVi]) => ranks.map(([rankEn, rankVi]) => [`${rankEn} of ${suitEn}`, `${rankVi} ${suitVi}`])),
);

export const tarotNamesVi: Record<string, string> = { ...majorNames, ...minorNames };
