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

const centeredRow = (count: number, step: number, scale = 1, y = 0): SpreadLayoutPosition[] => {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => ({
    x: (index - (safeCount - 1) / 2) * step,
    y,
    scale,
    rotation: 0,
  }));
};

/**
 * Resolve the inspected Moonlight arrangement from semantic position keys.
 * The returned coordinates are in the existing 900px Room table coordinate
 * system, so slots and face-up cards can share exactly the same geometry.
 */
export function resolveSpreadLayout(layoutKey: string | undefined, positions: readonly SpreadPositionLike[]): SpreadLayoutPosition[] {
  const keys = positions.map((position) => position.key);
  const row = (count: number, step: number, scale = 1, y = 0) => centeredRow(count, step, scale, y);
  let resolved: SpreadLayoutPosition[];

  switch (layoutKey) {
    case "single":
      resolved = [{ x: 0, y: -28, scale: 1.06, rotation: 0 }];
      break;
    case "row-2":
      resolved = row(keys.length, 340);
      break;
    case "row-3":
      resolved = row(keys.length, 250);
      break;
    case "row-4":
      resolved = row(keys.length, 215, 0.84, 34);
      break;
    case "row-5":
      resolved = row(keys.length, 178, 0.68, 38);
      break;
    case "triangle":
      resolved = keys.map((key, index) => {
        if (key === "creation" || index === 2) return { x: 0, y: 150, scale: 0.82, rotation: 0 };
        return { x: key === "receiving" || index === 1 ? 165 : -165, y: -72, scale: 0.82, rotation: 0 };
      });
      break;
    case "top-1-bottom-3":
      resolved = keys.map((key, index) => {
        if (key === "persona" || index === 0) return { x: 0, y: -110, scale: 0.68, rotation: 0 };
        const bottomIndex = Math.max(0, index - 1);
        return { x: (bottomIndex - 1) * 170, y: 145, scale: 0.72, rotation: 0 };
      });
      break;
    case "yes-no":
      resolved = keys.map((key, index) => {
        if (key === "if_yes" || index === 0) return { x: -125, y: -82, scale: 0.78, rotation: 0 };
        if (key === "if_no" || index === 1) return { x: 125, y: -82, scale: 0.78, rotation: 0 };
        if (key === "yes_leads_to" || index === 2) return { x: -205, y: 145, scale: 0.82, rotation: 0 };
        return { x: 205, y: 145, scale: 0.82, rotation: 0 };
      });
      break;
    case "cross-4":
      resolved = keys.map((key, index) => {
        if (key === "bridge" || index === 2) return { x: 0, y: -112, scale: 0.68, rotation: 0 };
        if (key === "path" || index === 3) return { x: 0, y: 165, scale: 0.72, rotation: 0 };
        return { x: key === "conflicting_energy" || index === 1 ? 160 : -160, y: 28, scale: 0.72, rotation: 0 };
      });
      break;
    case "celtic-cross":
      resolved = keys.map((key, index) => {
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
      break;
    default:
      resolved = row(keys.length, keys.length > 5 ? 250 : 250);
      break;
  }

  return keys.map((key, index) => {
    const position = resolved[index] || { x: 0, y: index * CARD_Y_STEP, scale: 1, rotation: 0 };
    return { ...position, x: Number(position.x.toFixed(2)), y: Number(position.y.toFixed(2)) };
  });
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
