export type ReadingSpreadCardWidth = {
  minCardWidth: number;
  maxCardWidth: number;
};

export function resolveReadingSpreadCardWidth(cardCount: number, mobile: boolean): ReadingSpreadCardWidth {
  const count = Number.isFinite(cardCount) ? Math.max(1, Math.floor(cardCount)) : 1;
  if (mobile) return { minCardWidth: 108, maxCardWidth: 140 };

  const maxCardWidth = count <= 1 ? 224 : count <= 3 ? 184 : count <= 5 ? 155 : 132;
  return { minCardWidth: 112, maxCardWidth };
}
