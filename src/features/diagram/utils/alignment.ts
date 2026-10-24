import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "../model/layout.constants";

export type AlignMode = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

/** A node's box in diagram space (a child's layout is relative to its parent; this is not). */
export interface AlignBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A locked node holds its place: it still bounds the others but never moves. */
  locked?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface LayoutLike {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * The selection's roots: nodes with no selected ancestor. A selected child rides along when its
 * panel moves, so aligning it as well would move it twice.
 */
export function selectionRoots(ids: readonly string[], parentOf: (id: string) => string | null) {
  const selected = new Set(ids);
  return ids.filter((id) => {
    let parent = parentOf(id);
    while (parent) {
      if (selected.has(parent)) return false;
      parent = parentOf(parent);
    }
    return true;
  });
}

/** Where a node's parent sits in diagram space (the origin its own layout is relative to). */
export function parentOrigin(
  id: string,
  parentOf: (id: string) => string | null,
  layoutOf: (id: string) => LayoutLike | undefined,
): Point {
  let x = 0;
  let y = 0;
  let parent = parentOf(id);
  while (parent) {
    const layout = layoutOf(parent);
    if (!layout) break;
    x += layout.x;
    y += layout.y;
    parent = parentOf(parent);
  }
  return { x, y };
}

export function boxOf(
  id: string,
  layout: LayoutLike,
  origin: Point,
  locked: boolean | undefined,
): AlignBox {
  return {
    id,
    x: origin.x + layout.x,
    y: origin.y + layout.y,
    width: layout.width ?? DEFAULT_NODE_W,
    height: layout.height ?? DEFAULT_NODE_H,
    locked,
  };
}

/** New diagram-space top-left for every box that has to move to satisfy `mode`. */
export function alignBoxes(boxes: readonly AlignBox[], mode: AlignMode): Map<string, Point> {
  const moved = new Map<string, Point>();
  if (boxes.length < 2) return moved;
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const top = Math.min(...boxes.map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  for (const box of boxes) {
    if (box.locked) continue;
    let x = box.x;
    let y = box.y;
    if (mode === "left") x = left;
    else if (mode === "right") x = right - box.width;
    else if (mode === "center-h") x = (left + right) / 2 - box.width / 2;
    else if (mode === "top") y = top;
    else if (mode === "bottom") y = bottom - box.height;
    else y = (top + bottom) / 2 - box.height / 2;
    if (x !== box.x || y !== box.y) moved.set(box.id, { x, y });
  }
  return moved;
}

/**
 * Equal gaps between boxes along `axis`: the two outermost stay, the ones between spread so the
 * spaces — not the centres — match. Needs three or more.
 */
export function distributeBoxes(
  boxes: readonly AlignBox[],
  axis: DistributeAxis,
): Map<string, Point> {
  const moved = new Map<string, Point>();
  if (boxes.length < 3) return moved;
  const horizontal = axis === "horizontal";
  const start = (b: AlignBox) => (horizontal ? b.x : b.y);
  const size = (b: AlignBox) => (horizontal ? b.width : b.height);
  const sorted = [...boxes].sort((a, b) => start(a) - start(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = start(last) + size(last) - start(first);
  const occupied = sorted.reduce((sum, b) => sum + size(b), 0);
  const gap = (span - occupied) / (sorted.length - 1);
  let cursor = start(first) + size(first) + gap;
  for (const box of sorted.slice(1, -1)) {
    if (!box.locked && cursor !== start(box)) {
      moved.set(box.id, horizontal ? { x: cursor, y: box.y } : { x: box.x, y: cursor });
    }
    cursor += size(box) + gap;
  }
  return moved;
}
