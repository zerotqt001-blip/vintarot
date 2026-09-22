import { resolveSpreadGeometry } from "./spread-geometry";

export type PanOffset = { x: number; y: number };

export type CardPosition = { x: number; y: number };

export type SpreadLayoutPosition = CardPosition & {
  scale: number;
  rotation: number;
};

type SpreadPositionLike = { key: string };

export type PointerPoint = { x: number; y: number };

export type FanSwipeProgress = {
  dx: number;
  dy: number;
  distance: number;
  active: boolean;
  progress: number;
};

export type SpreadCardPose = {
  tilt: number;
  lift: number;
  scale: number;
};

const MAX_PAN = 260;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const CARD_X_STEP = 250;
const CARD_Y_STEP = 355;
const MAX_CARD_COLUMNS = 5;
const MANY_CARD_COLUMNS = 3;

/**
 * Resolve the inspected Moonlight arrangement from semantic position keys.
 * The returned coordinates are in the existing 900px Room table coordinate
 * system, so slots and face-up cards can share exactly the same geometry.
 */
export function resolveSpreadLayout(layoutKey: string | undefined, positions: readonly SpreadPositionLike[]): SpreadLayoutPosition[] {
  return resolveSpreadGeometry(
    layoutKey,
    positions.map((position, index) => ({ key: position.key, order: index })),
  ).points.map(({ x, y, scale, rotation }) => ({ x, y, scale, rotation }));
}

/** Keep the camera movement inside the usable tabletop area. */
export function clampPan(offset: PanOffset, limit = MAX_PAN): PanOffset {
  return {
    x: Math.max(-limit, Math.min(limit, offset.x)),
    y: Math.max(-limit, Math.min(limit, offset.y)),
  };
}

/** Keep direct touch and wheel zoom inside the same bounds as the controls. */
export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

/** Return a stable slot aligned to the reading's fixed columns. */
export function spreadCardPosition(index: number, spreadCount: number): CardPosition {
  const safeIndex = Math.max(0, Math.floor(index));
  const requestedColumns = Math.floor(spreadCount) || 1;
  const columns = Math.max(1, Math.min(requestedColumns > MAX_CARD_COLUMNS ? MANY_CARD_COLUMNS : MAX_CARD_COLUMNS, requestedColumns));
  const row = Math.floor(safeIndex / columns);
  const column = safeIndex % columns;
  return {
    x: (column - (columns - 1) / 2) * CARD_X_STEP,
    y: row * CARD_Y_STEP,
  };
}

export function pointerDistance(a: PointerPoint, b: PointerPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointerCenter(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Normalize a fan gesture so touch movement can share one release threshold. */
export function fanSwipeProgress(start: PointerPoint, current: PointerPoint, threshold = 18): FanSwipeProgress {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const distance = Number(Math.hypot(dx, dy).toFixed(2));
  const safeThreshold = Math.max(1, threshold);
  return {
    dx,
    dy,
    distance,
    active: distance >= safeThreshold,
    progress: Number(Math.min(1, distance / safeThreshold).toFixed(2)),
  };
}

/** Scale a pinch gesture from its starting distance while respecting zoom bounds. */
export function zoomFromPinch(startZoom: number, startDistance: number, currentDistance: number): number {
  if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(currentDistance)) {
    return clampZoom(startZoom);
  }
  return clampZoom(startZoom * (currentDistance / startDistance));
}

/** Give spread cards a quiet arc, with a tactile lift for the focused card. */
export function spreadCardPose(index: number, count: number, focused: boolean): SpreadCardPose {
  const center = (Math.max(1, count) - 1) / 2;
  const normalized = center === 0 ? 0 : (index - center) / center;
  return {
    tilt: Number((normalized * 6).toFixed(2)),
    lift: focused ? -42 : 0,
    scale: focused ? 1.08 : 1,
  };
}
