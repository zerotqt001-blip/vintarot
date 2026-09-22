import type { NormalizedSpreadPosition } from "./tarot-spread-geometry";

export const RESPONSIVE_SPREAD_BOARD_BOUNDS = Object.freeze({
  width: 900,
  height: 620,
});

export const RESPONSIVE_SPREAD_CARD_BOUNDS = Object.freeze({
  width: 220,
  height: 356,
});

/** Room's existing camera starts at 70%; the board projection keeps that camera control intact. */
export const ROOM_REFERENCE_ZOOM = 0.7;

export type SpreadBoardViewport = {
  width: number;
  height: number;
  topInset?: number;
  bottomInset?: number;
};

export type SpreadBoardProjectionPosition = Omit<NormalizedSpreadPosition, "x" | "y"> & {
  /** Absolute left coordinate in the board's logical 900px canvas. */
  x: number;
  /** Absolute top coordinate in the board's logical 620px canvas. */
  y: number;
};

export type SpreadBoardProjection = {
  bounds: typeof RESPONSIVE_SPREAD_BOARD_BOUNDS;
  scale: number;
  offsetY: number;
  cardWidth: number;
  cardHeight: number;
  minimumCardWidth: number;
  positions: SpreadBoardProjectionPosition[];
};

export type SpreadBoardProjectionOptions = {
  safePadding?: number;
  minCardWidth?: number;
};

export type SpreadBoardItemStyle = {
  position: "absolute";
  left: string;
  top: string;
  transform: string;
  zIndex: number;
  "--natarot-spread-item-transform": string;
};

const finitePositive = (value: number, fallback: number): number => (
  Number.isFinite(value) && value > 0 ? value : fallback
);

const finiteNonNegative = (value: number, fallback: number): number => (
  Number.isFinite(value) && value >= 0 ? value : fallback
);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function targetMinimumCardWidth(viewportWidth: number): number {
  if (viewportWidth <= 480) return 76;
  if (viewportWidth <= 960) return 88;
  return 110;
}

/**
 * Project L1B normalized positions into the stable Room canvas while selecting a
 * viewport-aware camera scale. Small screens may retain a bounded internal board
 * overflow so ten- and twelve-card spreads do not collapse into unreadable cards.
 */
export function resolveSpreadBoardProjection(
  geometry: readonly NormalizedSpreadPosition[],
  viewport: SpreadBoardViewport,
  options: SpreadBoardProjectionOptions = {},
): SpreadBoardProjection {
  const viewportWidth = finitePositive(viewport.width, RESPONSIVE_SPREAD_BOARD_BOUNDS.width);
  const viewportHeight = finitePositive(viewport.height, RESPONSIVE_SPREAD_BOARD_BOUNDS.height);
  const safePadding = clamp(
    finiteNonNegative(options.safePadding ?? 16, 16),
    0,
    120,
  );
  const topInset = clamp(
    Number.isFinite(viewport.topInset) && (viewport.topInset as number) >= 0
      ? viewport.topInset as number
      : safePadding,
    0,
    viewportHeight / 2,
  );
  const bottomInset = clamp(
    Number.isFinite(viewport.bottomInset) && (viewport.bottomInset as number) >= 0
      ? viewport.bottomInset as number
      : safePadding,
    0,
    viewportHeight / 2,
  );
  const availableWidth = Math.max(240, viewportWidth - safePadding * 2);
  const availableHeight = Math.max(320, viewportHeight - topInset - bottomInset);
  const fitScale = clamp(
    Math.min(
      availableWidth / RESPONSIVE_SPREAD_BOARD_BOUNDS.width,
      availableHeight / RESPONSIVE_SPREAD_BOARD_BOUNDS.height,
    ),
    0.25,
    1,
  );
  const minimumLayoutScale = geometry.length
    ? Math.min(...geometry.map((position) => clamp(position.scale, 0.25, 1.5)))
    : 1;
  const minimumCardWidth = Math.max(
    48,
    options.minCardWidth ?? targetMinimumCardWidth(viewportWidth),
  );
  const readableScale = minimumCardWidth / (
    RESPONSIVE_SPREAD_CARD_BOUNDS.width * minimumLayoutScale
  );
  const scale = Number(clamp(Math.max(fitScale, readableScale), 0.25, 1).toFixed(4));
  const offsetY = Number(((topInset - bottomInset) / 2).toFixed(2));
  const positions = geometry.map((position) => ({
    key: position.key,
    order: position.order,
    x: Number((clamp(position.x, 0, 1) * RESPONSIVE_SPREAD_BOARD_BOUNDS.width).toFixed(2)),
    y: Number((clamp(position.y, 0, 1) * RESPONSIVE_SPREAD_BOARD_BOUNDS.height).toFixed(2)),
    rotation: position.rotation,
    zIndex: position.zIndex,
    scale: position.scale,
  }));

  return {
    bounds: RESPONSIVE_SPREAD_BOARD_BOUNDS,
    scale,
    offsetY,
    cardWidth: Number((RESPONSIVE_SPREAD_CARD_BOUNDS.width * scale).toFixed(2)),
    cardHeight: Number((RESPONSIVE_SPREAD_CARD_BOUNDS.height * scale).toFixed(2)),
    minimumCardWidth: Number((RESPONSIVE_SPREAD_CARD_BOUNDS.width * minimumLayoutScale * scale).toFixed(2)),
    positions,
  };
}

/** Keep the slot and card layers on exactly the same L1C projected coordinates. */
export function spreadBoardItemStyle(position: SpreadBoardProjectionPosition): SpreadBoardItemStyle {
  const transform = `translate(-50%, -50%) rotate(${position.rotation}deg) scale(${position.scale})`;
  return {
    position: "absolute",
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform,
    "--natarot-spread-item-transform": transform,
    zIndex: position.zIndex,
  };
}
