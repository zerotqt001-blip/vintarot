import type { ResolvedTarotSpread, ResolvedTarotSpreadPosition } from "./tarot-spread";

export type SpreadGeometryInput = Pick<ResolvedTarotSpreadPosition, "key"> &
  Partial<Pick<ResolvedTarotSpreadPosition, "order">>;

export type NormalizedSpreadPosition = {
  key: string;
  order: number;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  scale: number;
};

export type SpreadBoardBounds = {
  width: number;
  height: number;
};

export type ProjectedSpreadPosition = Omit<NormalizedSpreadPosition, "x" | "y"> & {
  x: number;
  y: number;
};

/**
 * The existing Room uses a 900px logical width and a 620px slot canvas. The
 * values are kept only at the projection boundary so the geometry contract
 * itself remains viewport-independent and can be projected onto any board.
 */
export const LEGACY_ROOM_BOARD_BOUNDS: Readonly<SpreadBoardBounds> = {
  width: 900,
  height: 620,
};

type LayoutPoint = {
  x: number;
  y: number;
  rotation?: number;
  zIndex?: number;
  scale?: number;
};

type OrderedInput = SpreadGeometryInput & { sourceIndex: number; resolvedOrder: number };

const normalized = (value: number): number => Number(Math.max(0, Math.min(1, value)).toFixed(6));

const legacyPoint = (
  x: number,
  y: number,
  scale = 1,
  rotation = 0,
  zIndex = 1,
): LayoutPoint => ({
  x: normalized(0.5 + x / LEGACY_ROOM_BOARD_BOUNDS.width),
  y: normalized(0.5 + y / LEGACY_ROOM_BOARD_BOUNDS.height),
  scale,
  rotation,
  zIndex,
});

const row = (count: number, step: number, scale = 1, y = 0): LayoutPoint[] => {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => legacyPoint(
    (index - (safeCount - 1) / 2) * step,
    y,
    scale,
  ));
};

const genericGridPoint = (index: number, count: number): LayoutPoint => {
  const safeCount = Math.max(1, Math.floor(count));
  const columns = safeCount <= 3 ? safeCount : safeCount <= 6 ? 3 : 4;
  const rowIndex = Math.floor(index / columns);
  const rowStart = rowIndex * columns;
  const rowCount = Math.min(columns, safeCount - rowStart);
  const column = index - rowStart;
  const xStep = rowCount <= 1 ? 0 : 0.68 / (rowCount - 1);
  const rows = Math.ceil(safeCount / columns);
  const y = rows <= 1 ? 0.5 : 0.22 + rowIndex * (0.56 / (rows - 1));
  const scale = safeCount <= 3 ? 0.82 : safeCount <= 4 ? 0.74 : safeCount <= 6 ? 0.68 : safeCount <= 8 ? 0.6 : safeCount <= 10 ? 0.54 : 0.5;

  return {
    x: normalized(rowCount <= 1 ? 0.5 : 0.16 + column * xStep),
    y: normalized(y),
    scale,
    rotation: 0,
    zIndex: 1,
  };
};

const keyedPoint = (
  key: string,
  index: number,
  points: Record<string, LayoutPoint>,
  fallback: LayoutPoint[],
): LayoutPoint => points[key] || fallback[index] || genericGridPoint(index, Math.max(fallback.length, index + 1));

function orderedInputs(positions: readonly SpreadGeometryInput[]): OrderedInput[] {
  return positions
    .map((position, sourceIndex) => ({
      ...position,
      key: position.key || `position-${sourceIndex}`,
      sourceIndex,
      resolvedOrder: Number.isFinite(position.order) ? Math.trunc(position.order as number) : sourceIndex,
    }))
    .sort((left, right) => left.resolvedOrder - right.resolvedOrder || left.sourceIndex - right.sourceIndex);
}

function layoutPoints(layoutKey: string | undefined, count: number, keys: readonly string[]): LayoutPoint[] {
  switch (layoutKey) {
    case "single":
      return count === 1 ? [legacyPoint(0, -28, 1.06)] : keys.map((_, index) => genericGridPoint(index, count));
    case "row-2":
      return row(count, 340);
    case "row-3":
      return row(count, 250);
    case "row-4":
      return row(count, 215, 0.9, 34);
    case "row-5":
      return row(count, 178, 0.68, 38);
    case "triangle": {
      const fallback = [
        legacyPoint(-165, -72, 0.82),
        legacyPoint(165, -72, 0.82),
        legacyPoint(0, 150, 0.82),
      ];
      return count === 3 ? keys.map((key, index) => keyedPoint(key, index, {
        giving: fallback[0],
        receiving: fallback[1],
        creation: fallback[2],
      }, fallback)) : keys.map((_, index) => genericGridPoint(index, count));
    }
    case "top-1-bottom-3": {
      const fallback = [
        legacyPoint(0, -110, 0.68),
        legacyPoint(-170, 145, 0.72),
        legacyPoint(0, 145, 0.72),
        legacyPoint(170, 145, 0.72),
      ];
      return count === 4 ? keys.map((key, index) => keyedPoint(key, index, {
        persona: fallback[0],
      }, fallback)) : keys.map((_, index) => genericGridPoint(index, count));
    }
    case "yes-no": {
      const fallback = [
        legacyPoint(-125, -82, 0.78),
        legacyPoint(125, -82, 0.78),
        legacyPoint(-205, 145, 0.82),
        legacyPoint(205, 145, 0.82),
      ];
      return count === 4 ? keys.map((key, index) => keyedPoint(key, index, {
        if_yes: fallback[0],
        if_no: fallback[1],
        yes_leads_to: fallback[2],
        no_leads_to: fallback[3],
      }, fallback)) : keys.map((_, index) => genericGridPoint(index, count));
    }
    case "cross-4": {
      const fallback = [
        legacyPoint(-160, 28, 0.72),
        legacyPoint(160, 28, 0.72),
        legacyPoint(0, -112, 0.68),
        legacyPoint(0, 165, 0.72),
      ];
      return count === 4 ? keys.map((key, index) => keyedPoint(key, index, {
        conflicting_energy: fallback[1],
        bridge: fallback[2],
        path: fallback[3],
      }, fallback)) : keys.map((_, index) => genericGridPoint(index, count));
    }
    case "celtic-cross": {
      const fallback = [
        legacyPoint(-160, 0, 0.62, 0, 1),
        legacyPoint(-160, 0, 0.62, 90, 2),
        legacyPoint(-160, 180, 0.62),
        legacyPoint(-390, 0, 0.62),
        legacyPoint(-160, -180, 0.62),
        legacyPoint(70, 0, 0.62),
        legacyPoint(335, 180, 0.56),
        legacyPoint(335, 60, 0.56),
        legacyPoint(335, -60, 0.56),
        legacyPoint(335, -180, 0.56),
      ];
      return count === 10 ? keys.map((key, index) => keyedPoint(key, index, {
        present: fallback[0],
        challenge: fallback[1],
        foundation: fallback[2],
        recent_past: fallback[3],
        possibility: fallback[4],
        near_future: fallback[5],
        approach: fallback[6],
        environment: fallback[7],
        hopes_fears: fallback[8],
        outcome: fallback[9],
      }, fallback)) : keys.map((_, index) => genericGridPoint(index, count));
    }
    default:
      return keys.map((_, index) => genericGridPoint(index, count));
  }
}

/** Resolve semantic spread positions into deterministic, serializable board coordinates. */
export function resolveNormalizedSpreadGeometry(
  layoutKey: string | undefined,
  positions: readonly SpreadGeometryInput[],
): NormalizedSpreadPosition[] {
  const ordered = orderedInputs(positions);
  const points = layoutPoints(layoutKey, ordered.length, ordered.map((position) => position.key));

  return ordered.map((position, index) => {
    const point = points[index] || genericGridPoint(index, ordered.length);
    return {
      key: position.key,
      order: position.resolvedOrder,
      x: normalized(point.x),
      y: normalized(point.y),
      rotation: Number((point.rotation || 0).toFixed(2)),
      zIndex: Math.max(0, Math.trunc(point.zIndex || 1)),
      scale: Number((point.scale || 1).toFixed(2)),
    };
  });
}

/** Resolve the L1A semantic contract without recreating spread identity or card count. */
export function resolveTarotSpreadGeometry(
  spread: Pick<ResolvedTarotSpread, "cardCount" | "spreadType" | "positions">,
): NormalizedSpreadPosition[] {
  if (spread.cardCount !== spread.positions.length) {
    throw new Error(
      `Resolved spread card count ${spread.cardCount} does not match ${spread.positions.length} positions`,
    );
  }

  const geometry = resolveNormalizedSpreadGeometry(spread.spreadType, spread.positions);
  if (geometry.length !== spread.cardCount) {
    throw new Error(
      `Resolved spread geometry count ${geometry.length} does not match ${spread.cardCount}`,
    );
  }

  return geometry;
}

/** Project normalized geometry into any board's local coordinate system. */
export function projectNormalizedSpreadGeometry(
  geometry: readonly NormalizedSpreadPosition[],
  bounds: SpreadBoardBounds,
): ProjectedSpreadPosition[] {
  const width = Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : 1;
  const height = Number.isFinite(bounds.height) && bounds.height > 0 ? bounds.height : 1;
  return geometry.map((position) => ({
    ...position,
    x: Number(((position.x - 0.5) * width).toFixed(2)),
    y: Number(((position.y - 0.5) * height).toFixed(2)),
  }));
}
