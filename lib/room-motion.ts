export type PanOffset = { x: number; y: number };

export type SpreadCardPose = {
  tilt: number;
  lift: number;
  scale: number;
};

const MAX_PAN = 260;

/** Keep the camera movement inside the usable tabletop area. */
export function clampPan(offset: PanOffset, limit = MAX_PAN): PanOffset {
  return {
    x: Math.max(-limit, Math.min(limit, offset.x)),
    y: Math.max(-limit, Math.min(limit, offset.y)),
  };
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
