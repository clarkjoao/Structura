/**
 * P4 — cross-cutting band.
 *
 * Observability, auth and secrets touch nearly everything. Drawing those relationships turns
 * any diagram into a web, so cross-cutting services get their own band below the main flow
 * and no edges by default. That is a deliberate layout decision, not an omission.
 *
 * Placement wraps into rows of at most CROSS_CUTTING_PER_ROW, then resolves any residual
 * collision by iterative push-down (from event-modeling-tools): simple, deterministic, and
 * it converges because every step moves a box strictly downward.
 */

import { LAYOUT, SPACING } from "../constants";
import { cloneState, type LayoutNode, type LayoutPass } from "../types";

export const layoutCrossCutting: LayoutPass = (input) => {
  const state = cloneState(input);

  const crossCutting = [...state.nodes.values()].filter((node) => node.tier === "cross-cutting");
  if (crossCutting.length === 0) return state;

  const mainFlow = [...state.nodes.values()].filter((node) => node.tier !== "cross-cutting");

  // The band starts below everything else, including boundaries.
  let flowBottom: number = LAYOUT.ORIGIN_Y;
  for (const node of mainFlow) {
    flowBottom = Math.max(flowBottom, node.y + node.height);
  }
  for (const boundary of state.boundaries.values()) {
    flowBottom = Math.max(flowBottom, boundary.y + boundary.height);
  }

  const bandTop = flowBottom + LAYOUT.CROSS_CUTTING_GAP;
  const { colGap, rowGap } = SPACING[state.density];

  // Order by where the consumers are, so a service sits under whatever uses it.
  //
  // Placing the band alphabetically looks tidy and reads badly: a service consumed by
  // something in the last column would sit at the far left, and the edge back to it crosses
  // the whole diagram — through every node in between. Anchoring to the mean consumer
  // position keeps those edges short and roughly vertical. Services with no consumer sort
  // last, since nothing constrains them.
  const anchorX = new Map<string, number>();
  for (const node of crossCutting) {
    const consumers: number[] = [];
    for (const connection of state.connections) {
      const peerId =
        connection.to === node.id
          ? connection.from
          : connection.from === node.id
            ? connection.to
            : undefined;
      if (!peerId) continue;
      const peer = state.nodes.get(peerId);
      if (peer && peer.tier !== "cross-cutting") consumers.push(peer.x + peer.width / 2);
    }
    anchorX.set(
      node.id,
      consumers.length > 0
        ? consumers.reduce((sum, value) => sum + value, 0) / consumers.length
        : Number.POSITIVE_INFINITY,
    );
  }

  const ordered = [...crossCutting].sort((a, b) => {
    const delta = anchorX.get(a.id)! - anchorX.get(b.id)!;
    // Alphabetical only as a tiebreak, so the band stays stable between runs.
    if (delta !== 0 && Number.isFinite(delta)) return delta;
    return a.id.localeCompare(b.id);
  });

  const placed: LayoutNode[] = [];
  let cursorX: number = LAYOUT.ORIGIN_X;
  let rowTop = bandTop;
  let rowHeight = 0;
  let inRow = 0;

  // Build the cross-cutting references map: for each main-flow node, which cross-cutting
  // services it is connected to (used by the renderer to draw a badge on the node).
  const crossCuttingById = new Set(crossCutting.map((n) => n.id));
  const refsByNode = new Map<string, string[]>();
  for (const connection of state.connections) {
    const toCc = crossCuttingById.has(connection.to);
    const fromCc = crossCuttingById.has(connection.from);
    if (!toCc && !fromCc) continue;
    if (connection.routing === "suppressed") continue; // suppressed edges don't draw
    const consumer = toCc ? connection.from : connection.to;
    if (!refsByNode.has(consumer)) refsByNode.set(consumer, []);
    refsByNode.get(consumer)!.push(toCc ? connection.to : connection.from);
  }

  for (const node of ordered) {
    if (inRow >= LAYOUT.CROSS_CUTTING_PER_ROW) {
      rowTop += rowHeight + rowGap;
      cursorX = LAYOUT.ORIGIN_X;
      rowHeight = 0;
      inRow = 0;
    }

    // Sit under the consumer when there is one, but never behind the previous node in the
    // row — the cursor is the floor, so the band stays packed and collision-free.
    const anchor = anchorX.get(node.id)!;
    node.x = Number.isFinite(anchor) ? Math.max(cursorX, anchor - node.width / 2) : cursorX;
    node.y = rowTop;

    pushDownUntilClear(node, placed, rowGap);

    placed.push(node);
    cursorX = node.x + node.width + colGap;
    rowHeight = Math.max(rowHeight, node.y + node.height - rowTop);
    inRow += 1;
  }

  // Annotate main-flow nodes with their cross-cutting references.
  for (const node of state.nodes.values()) {
    if (node.tier === "cross-cutting") continue;
    const refs = refsByNode.get(node.id);
    if (refs && refs.length > 0) node.crossCuttingRefs = refs;
  }

  return state;
};

/**
 * Pushes `node` down until it clears every already-placed box.
 *
 * Terminates because each iteration moves the node strictly downward past a box it
 * overlapped, and there are finitely many boxes.
 */
function pushDownUntilClear(node: LayoutNode, placed: readonly LayoutNode[], gap: number): void {
  let moved = true;
  while (moved) {
    moved = false;
    for (const other of placed) {
      const overlapsX = node.x < other.x + other.width && other.x < node.x + node.width;
      if (!overlapsX) continue;
      const overlapsY = node.y < other.y + other.height && other.y < node.y + node.height;
      if (!overlapsY) continue;

      node.y = other.y + other.height + gap;
      moved = true;
    }
  }
}
