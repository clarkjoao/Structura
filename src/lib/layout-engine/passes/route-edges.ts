/**
 * P7 — orthogonal edge routing with waypoints.
 *
 * Produces waypoints and routing mode for every connection, and resolves edge-anchor
 * placement from a polyline perspective.
 *
 * Routing modes:
 *  - suppressed  : endpoint in cross-cutting tier → no waypoints, no drawn arrow
 *  - direct      : adjacent columns, source/target vertically aligned → straight horizontal
 *  - gutter      : adjacent columns, no alignment → vertical channel in the gutter
 *  - forward-lane: skips ≥2 columns forward → rises to a reserved lane above the flow
 *  - return-lane : backward edge → falls to a reserved lane below the flow
 *
 * Channel assignment: forward edges use odd channel indices (source side stagger);
 * backward edges use even (target side stagger). This is what breaks the collinearity
 * that makes c3 and c4 look like one line.
 *
 * Lane reservation: greedy interval graph colouring of edge horizontal extents ensures
 * no two skip/return edges occupy the same lane.
 */
import { LAYOUT, SPACING, LANE_GAP, LANE_PITCH, CHANNEL_PITCH } from "../constants";
import { cloneState, type LayoutPass } from "../types";

// ─── Lane colouring ──────────────────────────────────────────────────────────

/**
 * Greedy interval graph colouring of edge horizontal extents.
 * Returns lane index (0 = nearest the flow) for each edge that needs a lane.
 * Edges whose extents don't overlap can share a lane.
 */
function assignLanes(
  edges: Array<{ id: string; x1: number; x2: number }>,
): Map<string, number> {
  if (edges.length === 0) return new Map();

  // Sort by left endpoint.
  const sorted = [...edges].sort((a, b) => a.x1 - b.x1);
  const assignments = new Map<string, number>();
  // tracks the rightmost occupied slot per lane.
  const laneEnds: number[] = [];

  for (const edge of sorted) {
    // Find first lane whose last occupant ends before this edge's start.
    let lane = laneEnds.findIndex((end) => end <= edge.x1);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(edge.x2);
    } else {
      laneEnds[lane] = edge.x2;
    }
    assignments.set(edge.id, lane);
  }

  return assignments;
}

// ─── Main pass ───────────────────────────────────────────────────────────────

export const routeEdges: LayoutPass = (input) => {
  const state = cloneState(input);

  const columnOf = new Map<string, { colIdx: number; tierIdx: number }>();
  state.columns.forEach((col, ci) =>
    col.nodeIds.forEach((id) => columnOf.set(id, { colIdx: ci, tierIdx: col.tierIndex })),
  );

  const gutterOf = new Map<number, { x: number; width: number; channelEdgeIds: string[] }>();
  for (const g of state.gutters) {
    gutterOf.set(g.index, { x: g.x, width: g.width, channelEdgeIds: [...g.channelEdgeIds] });
  }

  // Every column boundary has a gutter entry, even if it has no channels.
  // This lets us compute crossX / descentX without null checks for skipped columns.
  for (let ci = 0; ci < state.columns.length - 1; ci++) {
    if (!gutterOf.has(ci)) {
      const leftCol = state.columns[ci]!;
      const colGap = SPACING[state.density].colGap;
      gutterOf.set(ci, {
        x: leftCol.x + leftCol.width,
        width: colGap,
        channelEdgeIds: [],
      });
    }
  }

  const nodeCenterY = (id: string) => {
    const n = state.nodes.get(id)!;
    return n.y + n.height / 2;
  };

  // ── Phase 1: classify edges ────────────────────────────────────────────────

  const gutterEdges: Array<{ connId: string; gutterIdx: number; channelIdx: number }> = [];
  const forwardLaneEdges: Array<{ id: string; srcX: number; dstX: number }> = [];
  const returnLaneEdges: Array<{ id: string; srcX: number; dstX: number }> = [];

  for (const conn of state.connections) {
    const fromCol = columnOf.get(conn.from);
    const toCol = columnOf.get(conn.to);
    if (fromCol === undefined || toCol === undefined) continue;

    const fromTier = state.nodes.get(conn.from)?.tier;
    const toTier = state.nodes.get(conn.to)?.tier;

    if (fromTier === "cross-cutting" || toTier === "cross-cutting") {
      conn.routing = "suppressed";
      continue;
    }

    // Only collect data; routing mode is determined fresh in Phase 3.
    // Use tierIdx (not colIdx) to detect tier-skipping even when intermediate tiers are empty.
    const sameColumn = fromCol.colIdx === toCol.colIdx;
    const isAdjacent = !sameColumn && Math.abs(toCol.tierIdx - fromCol.tierIdx) === 1;
    const srcCenterY = nodeCenterY(conn.from);
    const tgtCenterY = nodeCenterY(conn.to);
    const aligned = Math.abs(srcCenterY - tgtCenterY) <= 8 /* ALIGNMENT_TOLERANCE */;

    if (isAdjacent && !aligned) {
      const gIdx = Math.min(fromCol.colIdx, toCol.colIdx);
      const gutter = gutterOf.get(gIdx);
      if (gutter) {
        const chIdx = gutter.channelEdgeIds.indexOf(conn.id);
        gutterEdges.push({ connId: conn.id, gutterIdx: gIdx, channelIdx: chIdx });
      }
    } else if (!sameColumn && !isAdjacent) {
      if (toCol.tierIdx > fromCol.tierIdx) {
        forwardLaneEdges.push({
          id: conn.id,
          srcX: state.nodes.get(conn.from)!.x,
          dstX: state.nodes.get(conn.to)!.x + state.nodes.get(conn.to)!.width,
        });
      } else {
        returnLaneEdges.push({
          id: conn.id,
          srcX: state.nodes.get(conn.to)!.x,
          dstX: state.nodes.get(conn.from)!.x + state.nodes.get(conn.from)!.width,
        });
      }
    }
  }

  // ── Phase 2: assign lanes ────────────────────────────────────────────────

  const forwardLane = assignLanes(forwardLaneEdges.map((e) => ({ id: e.id, x1: e.srcX, x2: e.dstX })));
  const returnLane = assignLanes(returnLaneEdges.map((e) => ({ id: e.id, x1: e.srcX, x2: e.dstX })));

  // Compute lane y-coordinates.
  // Forward lanes: above the top of the flow.
  // Return lanes: below the flow.
  const flowTop = state.nodes.size > 0
    ? Math.min(...[...state.nodes.values()].map((n) => n.y))
    : LAYOUT.ORIGIN_Y;
  const flowBottom = state.nodes.size > 0
    ? Math.max(...[...state.nodes.values()].map((n) => n.y + n.height))
    : LAYOUT.ORIGIN_Y + 300;

  const forwardLaneY = (k: number) => flowTop - LANE_GAP - (k + 1) * LANE_PITCH;
  const returnLaneY = (k: number) => flowBottom + LANE_GAP + k * LANE_PITCH;

  const maxForwardLane = forwardLane.size > 0 ? Math.max(...forwardLane.values()) + 1 : 0;
  const maxReturnLane = returnLane.size > 0 ? Math.max(...returnLane.values()) + 1 : 0;
  state.lanes = {
    forward: Array.from({ length: maxForwardLane }, (_, k) => forwardLaneY(k)),
    return: Array.from({ length: maxReturnLane }, (_, k) => returnLaneY(k)),
  };

  // ── Phase 3: compute waypoints ────────────────────────────────────────────

  for (const conn of state.connections) {
    const srcNode = state.nodes.get(conn.from);
    const tgtNode = state.nodes.get(conn.to);
    if (!srcNode || !tgtNode) continue;

    if (conn.routing === "suppressed") {
      continue;
    }

    // Determine routing mode fresh (idempotent — don't depend on pre-existing conn.routing).
    const fromCol = columnOf.get(conn.from)!;
    const toCol = columnOf.get(conn.to)!;
    const sameColumn = fromCol.colIdx === toCol.colIdx;
    const isAdjacent = !sameColumn && Math.abs(toCol.tierIdx - fromCol.tierIdx) === 1;
    const srcCenterY = srcNode.y + srcNode.height / 2;
    const tgtCenterY = tgtNode.y + tgtNode.height / 2;
    const aligned = Math.abs(srcCenterY - tgtCenterY) <= 8;

    const rightEdge = srcNode.x + srcNode.width;
    const leftEdge = tgtNode.x;
    const srcCy = srcCenterY;
    const tgtCy = tgtCenterY;

    let mode: "direct" | "gutter" | "forward-lane" | "return-lane";
    if (sameColumn || (isAdjacent && aligned)) {
      mode = "direct";
    } else if (isAdjacent) {
      mode = "gutter";
    } else if (toCol.tierIdx > fromCol.tierIdx) {
      mode = "forward-lane";
    } else {
      mode = "return-lane";
    }
    conn.routing = mode;

    // Right edge of source, left edge of target. For lane routing, offset by LANE_PITCH
    // to avoid the vertical segment running along a node boundary (which would cause
    // segmentIntersectsRect to detect a corner hit on adjacent nodes in the same column).
    const isLaneMode = mode === "forward-lane" || mode === "return-lane";
    const srcRight = rightEdge + (isLaneMode ? LANE_PITCH : 0);
    const tgtLeft = leftEdge - (isLaneMode ? LANE_PITCH : 0);
    const srcCy2 = srcCy;
    const tgtCy2 = tgtCy;

    if (mode === "direct") {
      conn.waypoints = [
        { x: srcRight, y: srcCy2 },
        { x: tgtLeft, y: tgtCy2 },
      ];
    } else if (mode === "gutter") {
      const gEntry = gutterEdges.find((g) => g.connId === conn.id);
      if (!gEntry) {
        // No gutter built for this edge — fall back to direct.
        mode = "direct";
        conn.waypoints = [{ x: srcRight, y: srcCy2 }, { x: tgtLeft, y: tgtCy2 }];
      } else {
        const gutter = gutterOf.get(gEntry.gutterIdx)!;
        // channelIdx is 0-based. Stagger: forward edges (src is left) use odd channels,
        // backward edges use even channels (already staggered by target-side slot).
        const isForward = fromCol.tierIdx < toCol.tierIdx;
        const channelOffset = isForward
          ? 2 * gEntry.channelIdx + 1  // odd channels
          : 2 * gEntry.channelIdx;       // even channels
        const channelX = gutter.x + LAYOUT.ARROWHEAD_CLEARANCE + channelOffset * CHANNEL_PITCH;
        conn.waypoints = [
          { x: srcRight, y: srcCy2 },
          { x: channelX, y: srcCy2 },
          { x: channelX, y: tgtCy2 },
          { x: tgtLeft, y: tgtCy2 },
        ];
      }
    } else if (mode === "forward-lane") {
      const laneIdx = forwardLane.get(conn.id) ?? 0;
      const ly = state.lanes.forward[laneIdx]!;
      // The horizontal segment between source and target gutter must stay in gutters —
      // never inside an intermediate node column. The pattern is:
      //   rise in source gutter → horizontal in gutter before target → descend in target gutter.
      // crossX is in the gutter immediately before the target column, staggered by lane.
      const tgtGutter = gutterOf.get(toCol.colIdx - 1)!;
      const crossX = tgtGutter.x + (laneIdx + 1) * LANE_PITCH;
      conn.waypoints = [
        { x: srcRight, y: srcCy2 },
        { x: srcRight, y: ly },       // rise in source gutter
        { x: crossX, y: ly },         // horizontal in gutter before target
        { x: crossX, y: tgtCy2 },     // descend in target gutter
        { x: tgtLeft, y: tgtCy2 },
      ];
    } else if (mode === "return-lane") {
      const laneIdx = returnLane.get(conn.id) ?? 0;
      const ly = state.lanes.return[laneIdx]!;
      // For return-lane targeting the first column (colIdx=0), there is no gutter before it.
      // Use gutter 0 (between col 0 and col 1) as the routing anchor for return-lane
      // targeting col 0. This keeps all routing in gutters 0–n, never entering col 6
      // (cross-cutting). The final horizontal segment goes from gutter 0 to the target node.
      const tgtGutter = gutterOf.get(0)!;
      const crossX = tgtGutter.x + tgtGutter.width - (laneIdx + 1) * LANE_PITCH;
      conn.waypoints = [
        { x: srcRight, y: srcCy2 },
        { x: srcRight, y: ly },
        { x: crossX, y: ly },
        { x: crossX, y: tgtCy2 },
        { x: tgtLeft, y: tgtCy2 },
      ];
    }
  }

  return state;
};
