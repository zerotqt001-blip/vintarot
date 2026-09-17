export type PanOffset = { x: number; y: number };

export type CardPosition = { x: number; y: number };

export type PointerPoint = { x: number; y: number };

export type RoomRect = { left: number; top: number; width: number; height: number };

export type FanReleaseOrigin = { x: number; y: number; scale: number };

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

/** Measure the selected fan card's starting pose relative to its fixed spread slot. */
export function fanReleaseOrigin(
  source: RoomRect,
  table: RoomRect,
  target: CardPosition,
  factor: number,
  dropPoint?: PointerPoint,
): FanReleaseOrigin {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const releaseX = dropPoint ? dropPoint.x : source.left + source.width / 2;
  const releaseTop = dropPoint ? dropPoint.y - source.height / 2 : source.top;
  return {
    x: Number(((releaseX - table.left - table.width / 2) / safeFactor - target.x).toFixed(2)),
    y: Number(((releaseTop - table.top) / safeFactor - 12 - target.y).toFixed(2)),
    scale: Number((source.width / (220 * safeFactor)).toFixed(3)),
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
