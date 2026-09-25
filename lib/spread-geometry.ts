import {
  LEGACY_ROOM_BOARD_BOUNDS,
  projectNormalizedSpreadGeometry,
  resolveNormalizedSpreadGeometry,
  type SpreadGeometryInput,
} from "./tarot-spread-geometry";

export type SpreadPositionInput = SpreadGeometryInput & {
  order: number;
};

export type SpreadGeometryPoint = {
  key: string;
  order: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  normalizedX: number;
  normalizedY: number;
};

export type SpreadGeometryBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type SpreadGeometry = {
  layoutKey: string;
  canonical: boolean;
  points: SpreadGeometryPoint[];
  bounds: SpreadGeometryBounds;
};

export type SpreadProjectionOptions = {
  width: number;
  height: number;
  cardAspectRatio: number;
  minCardWidth: number;
  maxCardWidth: number;
  mobile: boolean;
};

export type SpreadProjectionCard = {
  key: string;
  order: number;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
};

export type SpreadProjection = {
  mode: "geometry" | "ordered";
  width: number;
  height: number;
  cards: SpreadProjectionCard[];
};

const KNOWN_LAYOUTS = new Set([
  "single",
  "row-2",
  "row-3",
  "row-4",
  "row-5",
  "triangle",
  "top-1-bottom-3",
  "yes-no",
  "cross-4",
  "celtic-cross",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compatibility facade for Reading Result.
 *
 * The canonical layout table lives in tarot-spread-geometry and is shared by
 * Room and SpreadBoard. This module only adapts that normalized contract to
 * the older projection shape used by the reading renderer.
 */
export function resolveSpreadGeometry(
  layoutKey: string | undefined,
  positions: readonly SpreadPositionInput[],
): SpreadGeometry {
  const normalized = resolveNormalizedSpreadGeometry(layoutKey, positions);
  const projected = projectNormalizedSpreadGeometry(normalized, LEGACY_ROOM_BOARD_BOUNDS);
  const duplicateCoordinates = new Map<string, number>();
  const points = normalized.map((point, index) => {
    const projectedPoint = projected[index];
    const coordinateKey = String(point.x) + ":" + String(point.y);
    const duplicateIndex = duplicateCoordinates.get(coordinateKey) || 0;
    duplicateCoordinates.set(coordinateKey, duplicateIndex + 1);
    const epsilon = duplicateIndex * 0.0001;

    return {
      key: point.key,
      order: point.order,
      x: projectedPoint.x,
      y: projectedPoint.y,
      scale: point.scale,
      rotation: point.rotation,
      normalizedX: Number(clamp(point.x + epsilon, 0, 1).toFixed(5)),
      normalizedY: Number(clamp(point.y + epsilon, 0, 1).toFixed(5)),
    };
  });

  const values = points.length ? points : [{ x: 0, y: 0 }];
  return {
    layoutKey: layoutKey || "unknown",
    canonical: KNOWN_LAYOUTS.has(layoutKey || ""),
    points,
    bounds: {
      left: Math.min(...values.map((point) => point.x)),
      right: Math.max(...values.map((point) => point.x)),
      top: Math.min(...values.map((point) => point.y)),
      bottom: Math.max(...values.map((point) => point.y)),
    },
  };
}

/** Project the canonical geometry into a measured Reading Result viewport. */
export function projectSpreadGeometry(
  geometry: SpreadGeometry,
  options: SpreadProjectionOptions,
): SpreadProjection {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const cardAspectRatio = Number.isFinite(options.cardAspectRatio) && options.cardAspectRatio > 0
    ? options.cardAspectRatio
    : 400 / 647;
  const minCardWidth = Math.max(1, options.minCardWidth);
  const maxCardWidth = Math.max(minCardWidth, options.maxCardWidth);
  const horizontalSpan = Math.max(0, geometry.bounds.right - geometry.bounds.left);
  const estimatedBaseWidth = clamp(width / Math.max(1, horizontalSpan / 200 + 1), minCardWidth, maxCardWidth);
  const smallestScaledWidth = geometry.points.length
    ? estimatedBaseWidth * Math.min(...geometry.points.map((point) => point.scale))
    : estimatedBaseWidth;
  const shouldOrderCards = options.mobile
    && (smallestScaledWidth < minCardWidth * 0.95 || geometry.points.length > 2);

  if (shouldOrderCards) {
    const cardWidth = clamp(Math.min(maxCardWidth, width - 32), minCardWidth, maxCardWidth);
    const cards = geometry.points.map((point, index) => {
      const cardHeight = cardWidth / cardAspectRatio;
      return {
        key: point.key,
        order: point.order,
        left: Number(((width - cardWidth) / 2).toFixed(2)),
        top: Number((16 + index * (cardHeight + 96)).toFixed(2)),
        width: Number(cardWidth.toFixed(2)),
        height: Number(cardHeight.toFixed(2)),
        rotation: 0,
        scale: 1,
      };
    });
    const projectedHeight = cards.length
      ? cards[cards.length - 1].top + cards[cards.length - 1].height + 16
      : height;
    return {
      mode: "ordered",
      width,
      height: Math.max(height, Number(projectedHeight.toFixed(2))),
      cards,
    };
  }

  const cards = geometry.points.map((point) => {
    const cardWidth = estimatedBaseWidth * point.scale;
    const cardHeight = cardWidth / cardAspectRatio;
    const centerX = point.normalizedX * (width - cardWidth) + cardWidth / 2;
    const centerY = point.normalizedY * (height - cardHeight) + cardHeight / 2;
    return {
      key: point.key,
      order: point.order,
      left: Number(clamp(centerX - cardWidth / 2, 0, Math.max(0, width - cardWidth)).toFixed(2)),
      top: Number(clamp(centerY - cardHeight / 2, 0, Math.max(0, height - cardHeight)).toFixed(2)),
      width: Number(cardWidth.toFixed(2)),
      height: Number(cardHeight.toFixed(2)),
      rotation: point.rotation,
      scale: point.scale,
    };
  });

  return { mode: "geometry", width, height, cards };
}
