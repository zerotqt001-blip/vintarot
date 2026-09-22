'use client';

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import {
  resolveSpreadBoardProjection,
  RESPONSIVE_SPREAD_BOARD_BOUNDS,
  ROOM_REFERENCE_ZOOM,
  spreadBoardItemStyle,
  type SpreadBoardProjection,
  type SpreadBoardProjectionPosition,
  type SpreadBoardViewport,
} from "@/lib/spread-board";
import type { NormalizedSpreadPosition } from "@/lib/tarot-spread-geometry";

export type SpreadBoardRenderPosition = {
  position: SpreadBoardProjectionPosition;
  style: CSSProperties;
};

export type SpreadBoardCard<T> = {
  item: T;
  positionIndex: number;
  key: string | number;
};

type SpreadBoardProps<T> = {
  geometry: readonly NormalizedSpreadPosition[];
  labels: readonly string[];
  cards: readonly SpreadBoardCard<T>[];
  viewportRef: RefObject<HTMLDivElement | null>;
  occlusionRef?: RefObject<HTMLDivElement | null>;
  occlusionActive?: boolean;
  renderSlot: (label: string, index: number, position: SpreadBoardRenderPosition) => ReactNode;
  renderCard: (card: T, index: number, position: SpreadBoardRenderPosition) => ReactNode;
};

const SPREAD_BOARD_CSS = `
.natarot-spread-board-shell{position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:2}
.natarot-spread-board-canvas{position:absolute;left:50%;top:50%;width:${RESPONSIVE_SPREAD_BOARD_BOUNDS.width}px;height:${RESPONSIVE_SPREAD_BOARD_BOUNDS.height}px;transform:translate(-50%,calc(-50% + var(--natarot-spread-board-offset-y,0px))) scale(var(--natarot-spread-board-scale,1));transform-origin:center;pointer-events:none}
.room-page .natarot-spread-board-slot-layer{position:absolute!important;inset:0!important;display:block!important;width:${RESPONSIVE_SPREAD_BOARD_BOUNDS.width}px!important;height:${RESPONSIVE_SPREAD_BOARD_BOUNDS.height}px!important;gap:0!important;overflow:visible!important}
.room-page .natarot-spread-board-slot-layer .spread-slot{position:absolute!important;transform-origin:center center!important}
.natarot-spread-board-card-layer{position:absolute;inset:0;pointer-events:none}
.natarot-spread-board-card-layer>.drawn-card{pointer-events:auto}
.room-page .natarot-spread-board-slot-layer .spread-slot[style*="rotate(90deg)"]{transform:var(--natarot-spread-item-transform)!important}
`;

function viewportSize(
  element: HTMLDivElement | null,
  occlusionElement: HTMLDivElement | null,
  occlusionActive: boolean,
): SpreadBoardViewport {
  return {
    width: element?.clientWidth || RESPONSIVE_SPREAD_BOARD_BOUNDS.width,
    height: element?.clientHeight || RESPONSIVE_SPREAD_BOARD_BOUNDS.height,
    topInset: 16,
    bottomInset: occlusionActive ? (occlusionElement?.clientHeight || 0) + 16 : 16,
  };
}

function geometrySignature(geometry: readonly NormalizedSpreadPosition[]): string {
  return geometry
    .map((position) => [position.key, position.order, position.x, position.y, position.rotation, position.zIndex, position.scale].join(":"))
    .join("|");
}

function renderPosition(
  projection: SpreadBoardProjection,
  positionIndex: number,
  fallbackIndex: number,
): SpreadBoardRenderPosition | null {
  const position = projection.positions[positionIndex] || projection.positions[fallbackIndex];
  if (!position) return null;
  return {
    position,
    style: spreadBoardItemStyle(position) as CSSProperties,
  };
}

export default function SpreadBoard<T>({
  geometry,
  labels,
  cards,
  viewportRef,
  occlusionRef,
  occlusionActive = true,
  renderSlot,
  renderCard,
}: SpreadBoardProps<T>) {
  const [viewport, setViewport] = useState<SpreadBoardViewport>(() => viewportSize(null, null, occlusionActive));
  const signature = geometrySignature(geometry);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const update = () => {
      const next = viewportSize(element, occlusionRef?.current || null, occlusionActive);
      setViewport((previous) => (
        previous.width === next.width
          && previous.height === next.height
          && previous.topInset === next.topInset
          && previous.bottomInset === next.bottomInset
          ? previous
          : next
      ));
    };

    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (occlusionRef?.current) observer.observe(occlusionRef.current);
    return () => observer.disconnect();
  }, [occlusionActive, occlusionRef, signature, viewportRef]);

  const projection = resolveSpreadBoardProjection(geometry, viewport);
  const canvasStyle = {
    "--natarot-spread-board-scale": String(projection.scale / ROOM_REFERENCE_ZOOM),
    "--natarot-spread-board-offset-y": `${projection.offsetY / Math.max(projection.scale, 0.25)}px`,
  } as CSSProperties;

  return <>
    <style data-natarot-spread-board-style>{SPREAD_BOARD_CSS}</style>
    <div className="natarot-spread-board-shell" data-spread-board="responsive">
      <div className="natarot-spread-board-canvas" style={canvasStyle}>
        <div className="spread-slots positioned-slots natarot-spread-board-slot-layer">
          {labels.map((label, index) => {
            const position = renderPosition(projection, index, index);
            return position ? <Fragment key={position.position.key}>{renderSlot(label, index, position)}</Fragment> : null;
          })}
        </div>
        <div className="natarot-spread-board-card-layer">
          {cards.map((card, index) => {
            const position = renderPosition(projection, card.positionIndex, index);
            return position ? <Fragment key={`${card.key}-${position.position.key}`}>{renderCard(card.item, index, position)}</Fragment> : null;
          })}
        </div>
      </div>
    </div>
  </>;
}
