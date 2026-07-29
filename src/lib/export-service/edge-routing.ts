/**
 * Edge routing for draw.io export.
 *
 * This module re-creates the routing that React Flow computes at render time,
 * so the export matches the canvas visually.
 *
 * Key insight: React Flow does NOT expose its internal routing to external code.
 * The path functions (`getSmoothStepPath`, `getStepPolylinePoints`) live in
 * `@xyflow/system` but are not exported from `@xyflow/react`. We port the
 * relevant pure logic here, feeding it the same inputs React Flow would use:
 *
 *   - Node positions (from `nodeLayouts`, already relative-to-parent)
 *   - Slot assignments (from `buildHandleSlots`, matching canvas logic)
 *   - Source/target side (inferred from relative geometry)
 *
 * This gives us the exact polyline the canvas renders, with the correct handle
 * slot offsets, without needing to intercept React Flow internals.
 */

import type { Component } from "@/features/diagram";
import type { EdgeLayout, NodeLayout } from "@/features/diagram";
import { isApiGroupComponent, isPanelComponent } from "@/features/diagram";
import type { HandlePosition } from "@/features/canvas/edges/geometry/paths";
import { getStepPolylinePoints } from "@/features/canvas/edges/geometry/paths";

// ─── Handle position resolution ─────────────────────────────────────────────────

/** Slot-based handle distribution: how many handles per side, and which slot this edge occupies. */
export interface HandleSlots {
  sourceSlot: number;
  targetSlot: number;
  sourceCount: number;
  targetCount: number;
}

/**
 * Convert a handle slot index to a normalised anchor offset along a node side.
 * For N slots on a side, slot i gets position (i+1)/(N+1).
 * This matches how React Flow's buildHandles distributes handles visually.
 */
export function slotToAnchorOffset(slot: number, count: number): number {
  if (count <= 1) return 0.5;
  return (slot + 1) / (count + 1);
}

// ─── Source/target side inference ───────────────────────────────────────────────

export interface InferredSides {
  sourcePosition: HandlePosition;
  targetPosition: HandlePosition;
  exitX: number;
  exitY: number;
  entryX: number;
  entryY: number;
}

/**
 * Infer which handle side each end of the connection uses, based on the
 * relative geometry of source and target nodes.  This matches the logic
 * React Flow uses internally to select which handle the connection attaches to.
 *
 * For horizontal flows (target to the right): exit right, enter left.
 * For vertical flows (target below): exit bottom, enter top.
 * For container/panel targets: entry side is chosen based on where source sits.
 */
export function inferSourceTargetSides(
  sourceId: string,
  targetId: string,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
): InferredSides {
  const src = layoutMap[sourceId];
  const tgt = layoutMap[targetId];
  if (!src || !tgt) {
    return {
      sourcePosition: "right",
      targetPosition: "left",
      exitX: 1, exitY: 0.5,
      entryX: 0, entryY: 0.5,
    };
  }

  const srcW = src.width ?? 200;
  const srcH = src.height ?? 120;
  const tgtW = tgt.width ?? 200;
  const tgtH = tgt.height ?? 120;

  const srcCenterX = src.x + srcW / 2;
  const srcCenterY = src.y + srcH / 2;
  const tgtCenterX = tgt.x + tgtW / 2;
  const tgtCenterY = tgt.y + tgtH / 2;

  const dx = tgtCenterX - srcCenterX;
  const dy = tgtCenterY - srcCenterY;

  let sourcePosition: HandlePosition = "right";
  let targetPosition: HandlePosition = "left";
  let exitX = 1, exitY = 0.5, entryX = 0, entryY = 0.5;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
    if (dx > 0) {
      sourcePosition = "right"; targetPosition = "left";
      exitX = 1; exitY = 0.5; entryX = 0; entryY = 0.5;
    } else {
      sourcePosition = "left"; targetPosition = "right";
      exitX = 0; exitY = 0.5; entryX = 1; entryY = 0.5;
    }
  } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
    if (dy > 0) {
      sourcePosition = "bottom"; targetPosition = "top";
      exitX = 0.5; exitY = 1; entryX = 0.5; entryY = 0;
    } else {
      sourcePosition = "top"; targetPosition = "bottom";
      exitX = 0.5; exitY = 0; entryX = 0.5; entryY = 1;
    }
  }

  // For container/panel targets: choose entry side based on source position
  const tgtComp = components[targetId];
  if (tgtComp && (isPanelComponent(tgtComp) || isApiGroupComponent(tgtComp))) {
    const tgtLeft = tgt.x;
    const tgtRight = tgt.x + tgtW;
    const tgtTop = tgt.y;
    const tgtBottom = tgt.y + tgtH;

    if (srcCenterX < tgtLeft) {
      targetPosition = "left"; entryX = 0; entryY = 0.5;
    } else if (srcCenterX > tgtRight) {
      targetPosition = "right"; entryX = 1; entryY = 0.5;
    } else if (srcCenterY < tgtTop) {
      targetPosition = "top"; entryX = 0.5; entryY = 0;
    } else if (srcCenterY > tgtBottom) {
      targetPosition = "bottom"; entryX = 0.5; entryY = 1;
    }
  }

  return { sourcePosition, targetPosition, exitX, exitY, entryX, entryY };
}

// ─── Default waypoints (matching React Flow's smoothstep/step routing) ──────────

const SMOOTHSTEP_OFFSET = 20; // px gap from node edge before reconnecting

/**
 * Compute the default orthogonal waypoints that React Flow would trace for a
 * smoothstep/step edge between sourceAbs and targetAbs.
 *
 * This is a direct port of `getStepPolylinePoints` from the canvas geometry,
 * which is itself a clean-room implementation of @xyflow/system's internal logic.
 * The result matches exactly what the canvas renders for smoothstep/step edges
 * with no manually-edited waypoints.
 */
export function computeDefaultWaypoints(
  sourceAbs: { x: number; y: number; position: HandlePosition },
  targetAbs: { x: number; y: number; position: HandlePosition },
): { x: number; y: number }[] {
  const polyline = getStepPolylinePoints({
    source: { x: sourceAbs.x, y: sourceAbs.y },
    sourcePosition: sourceAbs.position,
    target: { x: targetAbs.x, y: targetAbs.y },
    targetPosition: targetAbs.position,
    offset: SMOOTHSTEP_OFFSET,
  });

  // polyline = [source, gappedSource?, ...intermediatePoints, gappedTarget?, target]
  // Return only the intermediate knots (exclude the source and target endpoints)
  return polyline.slice(1, -1);
}

// ─── Obstacle-aware waypoints for siblings inside the same container ────────────

/**
 * Whether a straight horizontal band at midY from x1→x2 intersects any occupied box.
 */
function hBandIntersectsBox(x1: number, x2: number, midY: number, box: { x: number; y: number; w: number; h: number }): boolean {
  return (
    box.y <= midY &&
    midY <= box.y + box.h &&
    Math.max(x1, box.x) < Math.min(x2, box.x + box.w)
  );
}

/**
 * Whether a straight vertical band at midX from y1→y2 intersects any occupied box.
 */
function vBandIntersectsBox(y1: number, y2: number, midX: number, box: { x: number; y: number; w: number; h: number }): boolean {
  return (
    box.x <= midX &&
    midX <= box.x + box.w &&
    Math.max(y1, box.y) < Math.min(y2, box.y + box.h)
  );
}

interface Box { x: number; y: number; w: number; h: number }

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Detect whether the direct orthogonal path between sourceAbs and targetAbs
 * would intersect any sibling node inside the container.
 *
 * We check two bands:
 * - Horizontal band at sourceAbs.y from sourceAbs.x→targetAbs.x
 * - Vertical band at targetAbs.x from sourceAbs.y→targetAbs.y
 *
 * If neither band hits an occupied box, the direct route is clear.
 */
function directPathBlocked(
  sourceAbs: { x: number; y: number },
  targetAbs: { x: number; y: number },
  occupiedBoxes: Box[],
): boolean {
  // Horizontal band from source to target at sourceAbs.y
  const hBlocked = occupiedBoxes.some((box) =>
    hBandIntersectsBox(
      Math.min(sourceAbs.x, targetAbs.x),
      Math.max(sourceAbs.x, targetAbs.x),
      sourceAbs.y,
      box,
    ),
  );
  if (!hBlocked) return false;

  // Vertical band from source to target at targetAbs.x
  const vBlocked = occupiedBoxes.some((box) =>
    vBandIntersectsBox(
      Math.min(sourceAbs.y, targetAbs.y),
      Math.max(sourceAbs.y, targetAbs.y),
      targetAbs.x,
      box,
    ),
  );
  return vBlocked;
}

/**
 * Build obstacle-aware waypoints for edges between sibling nodes inside the
 * same container, using the ABSOLUTE handle positions (with slot offsets applied).
 *
 * This replaces the previous `buildContainerWaypoints` which used relative coords
 * and ignored slot offsets — causing multiple edges on the same handle to collapse
 * onto the same point in the export.
 *
 * IMPORTANT: Only generates waypoints when the direct orthogonal path between
 * source and target is BLOCKED by an occupied sibling. If the direct path is
 * clear, returns undefined and lets draw.io compute its own orthogonal route.
 */
export function buildContainerWaypointsV2(
  sourceId: string,
  targetId: string,
  sourceAbs: { x: number; y: number },
  targetAbs: { x: number; y: number },
  components: Record<string, Component>,
  layoutMap: Record<string, NodeLayout>,
): { x: number; y: number }[] | undefined {
  const srcComp = components[sourceId];
  const tgtComp = components[targetId];
  if (!srcComp || !tgtComp) return undefined;

  // Find nearest common container ancestor
  const srcAncestors = new Set<string>();
  let p = srcComp.parentId;
  while (p) {
    srcAncestors.add(p);
    p = components[p]?.parentId;
  }

  let containerId: string | null = null;
  p = tgtComp.parentId;
  while (p) {
    if (srcAncestors.has(p) && components[p] && (isPanelComponent(components[p]!) || isApiGroupComponent(components[p]!))) {
      containerId = p;
      break;
    }
    p = components[p]?.parentId;
  }

  if (!containerId) return undefined;

  const containerLayout = layoutMap[containerId];
  if (!containerLayout) return undefined;

  // Helper: compute absolute position for any node by accumulating parent chain
  function toAbs(nodeId: string): { x: number; y: number; width: number; height: number } | undefined {
    const l = layoutMap[nodeId];
    const c = components[nodeId];
    if (!l || !c) return undefined;
    let absX = l.x, absY = l.y;
    let parentId = c.parentId;
    while (parentId) {
      const pl = layoutMap[parentId];
      if (!pl) break;
      absX += pl.x;
      absY += pl.y;
      parentId = components[parentId]?.parentId ?? null;
    }
    return { x: absX, y: absY, width: l.width ?? 200, height: l.height ?? 120 };
  }

  // Container bounds (absolute)
  const containerAbs = toAbs(containerId);
  if (!containerAbs) return undefined;
  const cLeft = containerAbs.x;
  const cTop = containerAbs.y;
  const cRight = containerAbs.x + containerAbs.width;
  const cBottom = containerAbs.y + containerAbs.height;

  const MARGIN = 5;

  // Collect occupied boxes in ABSOLUTE coordinates
  const occupiedBoxes: Box[] = [];
  for (const [id, comp] of Object.entries(components)) {
    if (id === sourceId || id === targetId || id === containerId) continue;
    if (comp.parentId !== containerId) continue;
    const abs = toAbs(id);
    if (!abs) continue;
    occupiedBoxes.push({ x: abs.x, y: abs.y, w: abs.width, h: abs.height });
  }

  // If no siblings besides source/target, no obstacle to route around
  if (occupiedBoxes.length === 0) return undefined;

  // Check if the direct orthogonal path is BLOCKED.
  // When source is to the right of target (going left), check obstacles between them.
  // When source is to the left of target (going right), check obstacles between them.
  // Obstacles BEHIND the source relative to travel direction don't block.
  const hBlocked = occupiedBoxes.some((box) => {
    // Obstacle must overlap the horizontal band at sourceAbs.y
    if (box.y > sourceAbs.y || sourceAbs.y > box.y + box.h) return false;
    // Obstacle must be BETWEEN source and target on the x-axis (not behind source)
    const betweenSrcAndTgt = targetAbs.x > sourceAbs.x
      ? box.x > sourceAbs.x && box.x < targetAbs.x  // going right: between source and target
      : box.x < sourceAbs.x && box.x > targetAbs.x; // going left: between source and target
    return betweenSrcAndTgt;
  });

  if (!hBlocked) return undefined;

  // Compute bounding box of all occupied boxes (absolute)
  let occMinX = Infinity, occMinY = Infinity, occMaxX = -Infinity, occMaxY = -Infinity;
  for (const box of occupiedBoxes) {
    occMinX = Math.min(occMinX, box.x);
    occMinY = Math.min(occMinY, box.y);
    occMaxX = Math.max(occMaxX, box.x + box.w);
    occMaxY = Math.max(occMaxY, box.y + box.h);
  }

  const isRightward = targetAbs.x > sourceAbs.x;

  if (isRightward) {
    // Route below the obstacles, clamped to container bounds
    const viaY = Math.min(occMaxY + MARGIN, cBottom - MARGIN);
    const viaX = Math.min(occMaxX + MARGIN, cRight - MARGIN);
    return [
      { x: sourceAbs.x, y: sourceAbs.y },
      { x: viaX, y: sourceAbs.y },
      { x: viaX, y: viaY },
      { x: targetAbs.x, y: viaY },
      { x: targetAbs.x, y: targetAbs.y },
    ];
  }

  // Route leftward: go above the obstacles, clamped to container bounds
  const viaX = Math.max(occMinX - MARGIN, cLeft + MARGIN);
  const viaY = Math.max(occMinY - MARGIN, cTop + MARGIN);
  return [
    { x: sourceAbs.x, y: sourceAbs.y },
    { x: viaX, y: sourceAbs.y },
    { x: viaX, y: viaY },
    { x: targetAbs.x, y: viaY },
    { x: targetAbs.x, y: targetAbs.y },
  ];
}

// ─── Complete routing resolution ────────────────────────────────────────────────

export interface EdgeRoutingResult {
  sourceAbs: { x: number; y: number; position: HandlePosition };
  targetAbs: { x: number; y: number; position: HandlePosition };
  sides: InferredSides;
  waypoints: { x: number; y: number }[] | undefined;
}

/**
 * Resolve the absolute handle position for one endpoint.
 * Accumulates parent chain for children, then applies slot offset.
 * `isSource` determines which slot index/count to use.
 */
function resolveAbs(
  nodeId: string,
  layout: NodeLayout,
  comp: Component,
  handlePosition: HandlePosition,
  slot: HandleSlots | undefined,
  isSource: boolean,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
): { x: number; y: number; position: HandlePosition } {
  // Accumulate parent chain for absolute position
  let absX = layout.x;
  let absY = layout.y;
  let parentId: string | null = comp.parentId;
  while (parentId) {
    const pl = layoutMap[parentId];
    if (!pl) break;
    absX += pl.x;
    absY += pl.y;
    parentId = components[parentId]?.parentId ?? null;
  }

  const w = layout.width ?? 200;
  const h = layout.height ?? 120;

  const slotCount = isSource ? (slot?.sourceCount ?? 1) : (slot?.targetCount ?? 1);
  const slotIndex = isSource ? (slot?.sourceSlot ?? 0) : (slot?.targetSlot ?? 0);
  const offset = slotToAnchorOffset(slotIndex, slotCount);

  let handleX: number, handleY: number;
  if (handlePosition === "right") {
    handleX = absX + w; handleY = absY + offset * h;
  } else if (handlePosition === "left") {
    handleX = absX; handleY = absY + offset * h;
  } else if (handlePosition === "bottom") {
    handleX = absX + offset * w; handleY = absY + h;
  } else {
    handleX = absX + offset * w; handleY = absY;
  }

  return { x: handleX, y: handleY, position: handlePosition };
}

/**
 * Resolve the complete routing for an edge: handle positions, sides, and waypoints.
 *
 * Priority:
 * 1. Manual waypoints from edgeLayout.points (user edits) — always win
 * 2. Container obstacle-aware waypoints (V2, with absolute coords + slot offsets)
 * 3. Default smoothstep waypoints (matching React Flow's built-in routing)
 *
 * This is the single entry point for the export service to get edge routing.
 */
export function resolveEdgeRouting(
  sourceId: string,
  targetId: string,
  layoutMap: Record<string, NodeLayout>,
  components: Record<string, Component>,
  edgeLayout: EdgeLayout | undefined,
  slot: HandleSlots | undefined,
): EdgeRoutingResult {
  // 1. User-authored waypoints always win
  const userWaypoints =
    edgeLayout?.points && edgeLayout.points.length > 0
      ? edgeLayout.points.map((p) => ({ x: p.x, y: p.y }))
      : undefined;

  // 2. Infer source/target sides (needed for handle position resolution)
  const sides = inferSourceTargetSides(sourceId, targetId, layoutMap, components);

  const srcLayout = layoutMap[sourceId];
  const tgtLayout = layoutMap[targetId];
  const srcComp = components[sourceId];
  const tgtComp = components[targetId];

  // 3. Resolve absolute handle positions with slot offsets
  const sourceAbs: { x: number; y: number; position: HandlePosition } =
    srcLayout && srcComp
      ? resolveAbs(
          sourceId, srcLayout, srcComp,
          sides.sourcePosition, slot, true, layoutMap, components,
        )
      : { x: 0, y: 0, position: "right" };

  const targetAbs: { x: number; y: number; position: HandlePosition } =
    tgtLayout && tgtComp
      ? resolveAbs(
          targetId, tgtLayout, tgtComp,
          sides.targetPosition, slot, false, layoutMap, components,
        )
      : { x: 0, y: 0, position: "left" };

  // 4. User waypoints override everything else
  if (userWaypoints) {
    return { sourceAbs, targetAbs, sides, waypoints: userWaypoints };
  }

  // 5. Try container obstacle-aware routing (only returns waypoints if blocked)
  const containerWaypoints = buildContainerWaypointsV2(
    sourceId, targetId, sourceAbs, targetAbs, components, layoutMap,
  );

  if (containerWaypoints) {
    return { sourceAbs, targetAbs, sides, waypoints: containerWaypoints };
  }

  // 6. Direct path: no waypoints — draw.io computes orthogonal route from
  // the anchor positions (exitX/Y, entryX/Y) we've set in `sides`.
  return { sourceAbs, targetAbs, sides, waypoints: undefined };
}
