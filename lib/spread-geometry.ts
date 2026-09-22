export type SpreadPositionInput = {
  key: string;
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

type RawPoint = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
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

const centeredRow = (count: number, step: number, scale = 1, y = 0): RawPoint[] => {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => ({
    x: (index - (safeCount - 1) / 2) * step,
    y,
    scale,
    rotation: 0,
  }));
};

function resolveRawPoints(layoutKey: string | undefined, positions: readonly SpreadPositionInput[]): RawPoint[] {
  const keys = positions.map((position) => position.key);
  const row = (count: number, step: number, scale = 1, y = 0) => centeredRow(count, step, scale, y);

  switch (layoutKey) {
    case "single":
      return [{ x: 0, y: -28, scale: 1.06, rotation: 0 }];
    case "row-2":
      return row(keys.length, 340);
    case "row-3":
      return row(keys.length, 250);
    case "row-4":
      return row(keys.length, 215, 0.9, 34);
    case "row-5":
      return row(keys.length, 178, 0.68, 38);
    case "triangle":
      return keys.map((key, index) => {
        if (key === "creation" || index === 2) return { x: 0, y: 150, scale: 0.82, rotation: 0 };
        return { x: key === "receiving" || index === 1 ? 165 : -165, y: -72, scale: 0.82, rotation: 0 };
      });
    case "top-1-bottom-3":
      return keys.map((key, index) => {
        if (key === "persona" || index === 0) return { x: 0, y: -110, scale: 0.68, rotation: 0 };
        const bottomIndex = Math.max(0, index - 1);
        return { x: (bottomIndex - 1) * 170, y: 145, scale: 0.72, rotation: 0 };
      });
    case "yes-no":
      return keys.map((key, index) => {
        if (key === "if_yes" || index === 0) return { x: -125, y: -82, scale: 0.78, rotation: 0 };
        if (key === "if_no" || index === 1) return { x: 125, y: -82, scale: 0.78, rotation: 0 };
        if (key === "yes_leads_to" || index === 2) return { x: -205, y: 145, scale: 0.82, rotation: 0 };
        return { x: 205, y: 145, scale: 0.82, rotation: 0 };
      });
    case "cross-4":
      return keys.map((key, index) => {
        if (key === "bridge" || index === 2) return { x: 0, y: -112, scale: 0.68, rotation: 0 };
        if (key === "path" || index === 3) return { x: 0, y: 165, scale: 0.72, rotation: 0 };
        return { x: key === "conflicting_energy" || index === 1 ? 160 : -160, y: 28, scale: 0.72, rotation: 0 };
      });
    case "celtic-cross":
      return keys.map((_, index) => {
        const fallback = [
          { x: -160, y: 0, scale: 0.62, rotation: 0 },
          { x: -160, y: 0, scale: 0.62, rotation: 90 },
          { x: -160, y: 180, scale: 0.62, rotation: 0 },
          { x: -390, y: 0, scale: 0.62, rotation: 0 },
          { x: -160, y: -180, scale: 0.62, rotation: 0 },
          { x: 70, y: 0, scale: 0.62, rotation: 0 },
          { x: 335, y: 180, scale: 0.56, rotation: 0 },
          { x: 335, y: 60, scale: 0.56, rotation: 0 },
          { x: 335, y: -60, scale: 0.56, rotation: 0 },
          { x: 335, y: -180, scale: 0.56, rotation: 0 },
        ];
        return fallback[index] || { x: 0, y: index * 80, scale: 0.56, rotation: 0 };
      });
    default:
      return row(keys.length, 250);
  }
}

function normalizedCoordinate(value: number, start: number, range: number): number {
  return range === 0 ? 0.5 : (value - start) / range;
}

/**
 * Resolve a spread into one ordered, reusable geometry contract.
 * Raw coordinates intentionally match the Room tabletop resolver so the
 * dealing surface and the Reading Result surface preserve the same meaning.
 */
export function resolveSpreadGeometry(layoutKey: string | undefined, positions: readonly SpreadPositionInput[]): SpreadGeometry {
  const layout = layoutKey || "unknown";
  const orderedPositions = positions
    .map((position, index) => ({ ...position, index }))
    .sort((left, right) => left.order - right.order || left.index - right.index);
  const rawPoints = resolveRawPoints(layoutKey, orderedPositions);
  const values = orderedPositions.map((_, index) => rawPoints[index] || { x: 0, y: index * 355, scale: 1, rotation: 0 });
  const bounds: SpreadGeometryBounds = {
    left: Math.min(...values.map((point) => point.x)),
    right: Math.max(...values.map((point) => point.x)),
    top: Math.min(...values.map((point) => point.y)),
    bottom: Math.max(...values.map((point) => point.y)),
  };
  const rangeX = bounds.right - bounds.left;
  const rangeY = bounds.bottom - bounds.top;
  const duplicateCoordinates = new Map<string, number>();
  const points = orderedPositions.map((position, index) => {
    const raw = values[index];
    const coordinateKey = `${raw.x}:${raw.y}`;
    const duplicateIndex = duplicateCoordinates.get(coordinateKey) || 0;
    duplicateCoordinates.set(coordinateKey, duplicateIndex + 1);
    const epsilon = duplicateIndex * 0.0001;
    return {
      key: position.key,
      order: position.order,
      x: Number(raw.x.toFixed(2)),
      y: Number(raw.y.toFixed(2)),
      scale: raw.scale,
      rotation: raw.rotation,
      normalizedX: Number(Math.min(1, Math.max(0, normalizedCoordinate(raw.x, bounds.left, rangeX) + epsilon)).toFixed(5)),
      normalizedY: Number(Math.min(1, Math.max(0, normalizedCoordinate(raw.y, bounds.top, rangeY) + epsilon)).toFixed(5)),
    };
  });

  return {
    layoutKey: layout,
    canonical: KNOWN_LAYOUTS.has(layout),
    points,
    bounds,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Project normalized geometry into a viewport. Dense spreads switch to a
 * vertical ordered sequence on small screens instead of shrinking into noise.
 */
export function projectSpreadGeometry(geometry: SpreadGeometry, options: SpreadProjectionOptions): SpreadProjection {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const cardAspectRatio = Number.isFinite(options.cardAspectRatio) && options.cardAspectRatio > 0 ? options.cardAspectRatio : 400 / 647;
  const minCardWidth = Math.max(1, options.minCardWidth);
  const maxCardWidth = Math.max(minCardWidth, options.maxCardWidth);
  const horizontalSpan = Math.max(0, geometry.bounds.right - geometry.bounds.left);
  const estimatedBaseWidth = clamp(width / Math.max(1, horizontalSpan / 200 + 1), minCardWidth, maxCardWidth);
  const smallestScaledWidth = geometry.points.length ? estimatedBaseWidth * Math.min(...geometry.points.map((point) => point.scale)) : estimatedBaseWidth;
  const shouldOrderCards = options.mobile && (smallestScaledWidth < minCardWidth * 0.95 || geometry.points.length > 6);

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
    const projectedHeight = cards.length ? cards[cards.length - 1].top + cards[cards.length - 1].height + 16 : height;
    return { mode: "ordered", width, height: Math.max(height, Number(projectedHeight.toFixed(2))), cards };
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
