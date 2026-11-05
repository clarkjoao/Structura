/**
 * Which edges are worth mounting for the current viewport, judged by the route
 * each one draws — not by its endpoints.
 *
 * React Flow can cull (`onlyRenderVisibleElements`), but it tests an edge with
 * the box around its two endpoint nodes. A long cross-panel edge spans the whole
 * canvas and would never be culled, and an edge whose route detours outside that
 * box would be culled while its detour is on screen. Here the box covers both
 * endpoint nodes *and* every stored corner, so it contains everything the edge
 * draws: if the box misses the window, the edge has nothing to show.
 *
 * The window is the viewport grown by a margin and snapped to a grid of half
 * viewports, so a pan only changes the result when it crosses a grid line —
 * not on every frame.
 */

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CullingWindow extends Box {
  /** Identifies the window: equal keys, equal windows. */
  key: string;
}

/** What the culling needs from an edge: its ends, its stored corners, and whether it must stay. */
export interface CullableEdge {
  id: string;
  source: string;
  target: string;
  selected?: boolean;
  data?: { layoutPoints?: readonly { x: number; y: number }[]; isActivePlayback?: boolean };
}

/** Margin around the viewport, in viewports, inside which edges stay mounted. */
const EDGE_CULLING_MARGIN = 1;

/**
 * The window to keep edges for: the viewport (in flow coordinates) grown by
 * `margin` viewports on every side, with its origin snapped to half-viewport
 * cells so that it only moves when the pan crosses a cell. Zoom is snapped to
 * quarter octaves for the same reason. `null` before React Flow has a size.
 */
export function cullingWindow(
  transform: readonly [number, number, number],
  width: number,
  height: number,
  margin: number = EDGE_CULLING_MARGIN,
): CullingWindow | null {
  const [tx, ty, zoom] = transform;
  if (!width || !height || !zoom) return null;
  const zoomStep = Math.floor(Math.log2(zoom) * 4);
  // The snapped zoom is never larger than the real one, so the snapped
  // viewport is never smaller than what is on screen.
  const snappedZoom = 2 ** (zoomStep / 4);
  const viewW = width / snappedZoom;
  const viewH = height / snappedZoom;
  const cellW = viewW / 2;
  const cellH = viewH / 2;
  const cellX = Math.floor(-tx / zoom / cellW);
  const cellY = Math.floor(-ty / zoom / cellH);
  // The real viewport starts inside cell (cellX, cellY), so it ends before
  // that cell's origin plus a viewport plus one cell.
  const originX = cellX * cellW;
  const originY = cellY * cellH;
  return {
    key: `${zoomStep}:${cellX}:${cellY}`,
    minX: originX - margin * viewW,
    minY: originY - margin * viewH,
    maxX: originX + viewW + cellW + margin * viewW,
    maxY: originY + viewH + cellH + margin * viewH,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** The box around both endpoint node boxes and every stored corner. */
export function edgeRouteBox(
  sourceBox: Box,
  targetBox: Box,
  corners: readonly { x: number; y: number }[] | undefined,
): Box {
  let minX = Math.min(sourceBox.minX, targetBox.minX);
  let minY = Math.min(sourceBox.minY, targetBox.minY);
  let maxX = Math.max(sourceBox.maxX, targetBox.maxX);
  let maxY = Math.max(sourceBox.maxY, targetBox.maxY);
  if (corners) {
    for (const point of corners) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/** An edge that must stay mounted wherever it is: selected, or the step being played. */
function isPinnedEdge(edge: CullableEdge): boolean {
  return edge.selected === true || edge.data?.isActivePlayback === true;
}

/**
 * The ids of the edges to mount. An edge whose endpoint has no known box yet
 * (not measured) is kept: culling must never hide something it cannot place.
 */
export function visibleEdgeIds(
  edges: readonly CullableEdge[],
  nodeBox: (id: string) => Box | undefined,
  window: Box,
): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (isPinnedEdge(edge)) {
      ids.add(edge.id);
      continue;
    }
    const sourceBox = nodeBox(edge.source);
    const targetBox = nodeBox(edge.target);
    if (!sourceBox || !targetBox) {
      ids.add(edge.id);
      continue;
    }
    if (overlaps(edgeRouteBox(sourceBox, targetBox, edge.data?.layoutPoints), window)) {
      ids.add(edge.id);
    }
  }
  return ids;
}

export function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}
