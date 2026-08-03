/**
 * P9 — grid snap.
 *
 * Runs last, once, on final geometry. Snapping between passes would let rounding error
 * accumulate: each pass would round its input, and a later pass would round that again.
 * Node sizes are left alone — those come from measurement and must keep matching what the
 * browser renders.
 *
 * Waypoints are also translated: routeEdges snaps node x to the grid before computing
 * waypoints, so entry/exit waypoints land on node edges at on-grid coordinates.
 * If any node ends up off-grid (e.g. future boundary changes), the translation below
 * ensures waypoints stay aligned with their node edge.
 */

import { snapToGrid } from "../constants";
import { cloneState, type LayoutPass } from "../types";

export const snapGeometry: LayoutPass = (input) => {
  const state = cloneState(input);

  // Capture pre-snap node edges so we can translate waypoints to match.
  const preSnapEdges = new Map<string, { left: number; right: number; top: number }>();
  for (const node of state.nodes.values()) {
    preSnapEdges.set(node.id, { left: node.x, right: node.x + node.width, top: node.y });
  }

  for (const node of state.nodes.values()) {
    node.x = snapToGrid(node.x);
    node.y = snapToGrid(node.y);
  }

  for (const boundary of state.boundaries.values()) {
    // Snap the edges, not the extents: rounding origin and size independently can shrink a
    // boundary below the content it must enclose.
    const right = boundary.x + boundary.width;
    const bottom = boundary.y + boundary.height;
    const snappedX = snapToGrid(boundary.x);
    const snappedY = snapToGrid(boundary.y);
    boundary.x = snappedX;
    boundary.y = snappedY;
    boundary.width = Math.ceil(right - snappedX);
    boundary.height = Math.ceil(bottom - snappedY);
  }

  for (const column of state.columns) {
    column.x = snapToGrid(column.x);
  }

  // Translate entry/exit waypoints whose endpoints moved when a node snapped.
  for (const connection of state.connections) {
    if (!connection.waypoints || connection.waypoints.length < 2) continue;

    const srcId = connection.from;
    const tgtId = connection.to;
    const preSrc = preSnapEdges.get(srcId);
    const postSrc = state.nodes.get(srcId);
    const preTgt = preSnapEdges.get(tgtId);
    const postTgt = state.nodes.get(tgtId);
    if (!preSrc || !postSrc || !preTgt || !postTgt) continue;

    const dxSrc = postSrc.x - preSrc.left;
    const dySrc = postSrc.y - preSrc.top;
    const dxTgt = postTgt.x - preTgt.left;
    const dyTgt = postTgt.y - preTgt.top;
    if (dxSrc === 0 && dySrc === 0 && dxTgt === 0 && dyTgt === 0) continue;

    // routeEdges computed entry waypoints at the pre-snap node edge. After the snap,
    // move them by the same delta so they stay flush with the node.
    const srcRight = preSrc.right;  // pre-snap right edge
    const tgtLeft = preTgt.left;    // pre-snap left edge
    const tgtRight = preTgt.right;  // pre-snap right edge (return-lane entry)

    connection.waypoints = connection.waypoints.map((p) => {
      let dx = 0, dy = 0;
      if (p.x === srcRight) { dx += dxSrc; dy += dySrc; }
      if (p.x === tgtLeft || p.x === tgtRight) { dx += dxTgt; dy += dyTgt; }
      // Snap y to the nearest grid multiple. Waypoints at entry/exit come from centerY which
      // may be .5 when node height is odd; translating by dy doesn't fix that since node.y
      // is already on-grid. Rounding here cleans up the residual.
      const snappedY = snapToGrid(p.y + dy);
      return { x: p.x + dx, y: snappedY };
    });
  }

  return state;
};
