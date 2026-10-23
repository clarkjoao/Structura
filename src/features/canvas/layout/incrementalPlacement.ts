import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import type { NodeLayout } from "@/features/diagram/model/layout.types";
import { isTextType } from "@/features/diagram/model/component-type-constants";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import type { AppliedLayout } from "./applyLayout";
import type { DiagramDirection } from "@/features/diagram/model/diagram.types";

/**
 * The automatic mode's placement: put only what the author just added, and
 * leave everything else exactly where it is.
 *
 * A fresh layout of the whole diagram after every insert re-shuffles it —
 * measured over the reference diagrams (`autoArrangeStability.experiment`), one
 * insert changed the place of 72% of the elements already there, by ~200px on
 * average, and ELK's interactive strategies did not help (as many moves, 16x
 * the crossings). So the automatic mode does not run ELK at all: a new element
 * goes one column after the element it is connected from (one before, when it
 * is the source), on the same row, and slides down until it overlaps nothing.
 * The reading direction holds — an input to the left, an output to the right —
 * and the full arrangement stays one click away (Arrange).
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IncrementalPlacementInput {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
  /** Sizes React Flow measured, which win over the stored ones. */
  measured?: ReadonlyMap<string, { width: number; height: number }>;
  /** The elements to place; everything else is fixed. */
  dirtyIds: readonly string[];
  /** Horizontal gap between an element and the one it connects to. */
  columnGap: number;
  /** Vertical clearance kept between elements. */
  rowGap: number;
  /**
   * The axis the diagram reads along (ADR-0013). Top-to-bottom places one row
   * below the source instead of one column right of it — the same placement in
   * the mirrored diagram (`axis.ts`).
   */
  direction?: DiagramDirection;
}

function sizeOf(
  id: string,
  nodeLayouts: Record<string, NodeLayout>,
  measured: IncrementalPlacementInput["measured"],
): { width: number; height: number } {
  const seen = measured?.get(id);
  if (seen) return { width: seen.width, height: seen.height };
  const stored = nodeLayouts[id];
  return {
    width: stored?.width && stored.width > 0 ? stored.width : DEFAULT_NODE_W,
    height: stored?.height && stored.height > 0 ? stored.height : DEFAULT_NODE_H,
  };
}

function overlaps(a: Box, b: Box, clearance: number): boolean {
  return (
    a.x < b.x + b.width + clearance &&
    b.x < a.x + a.width + clearance &&
    a.y < b.y + b.height + clearance &&
    b.y < a.y + a.height + clearance
  );
}

/**
 * Positions for the dirty elements that have something to sit next to, in
 * their parent's coordinates (as `nodeLayouts` stores them), plus a new size
 * for each container that had to grow to keep one of them inside. An element whose
 * neighbours are all dirty waits for one of them to be placed first; one with
 * no neighbour at all stays where it was put.
 */
export function placeIncrementally(input: IncrementalPlacementInput): AppliedLayout[] {
  if (input.direction !== "TB") return placeLeftToRight(input);
  const swap = (size: { width: number; height: number }) => ({
    width: size.height,
    height: size.width,
  });
  const mirrored = placeLeftToRight({
    ...input,
    nodeLayouts: Object.fromEntries(
      Object.entries(input.nodeLayouts).map(([id, layout]) => [
        id,
        {
          ...layout,
          x: layout.y,
          y: layout.x,
          ...(layout.width !== undefined && { height: layout.width }),
          ...(layout.height !== undefined && { width: layout.height }),
        },
      ]),
    ),
    ...(input.measured && {
      measured: new Map([...input.measured].map(([id, size]) => [id, swap(size)])),
    }),
  });
  return mirrored.map(({ elementId, x, y, width, height }) => ({
    elementId,
    x: y,
    y: x,
    ...(width !== undefined && height !== undefined && { width: height, height: width }),
  }));
}

function placeLeftToRight(input: IncrementalPlacementInput): AppliedLayout[] {
  const { components, connections, nodeLayouts, measured, columnGap, rowGap } = input;
  const dirty = new Set(input.dirtyIds.filter((id) => components[id] && nodeLayouts[id]));
  const placed = new Map<string, { x: number; y: number }>();

  const relative = (id: string): { x: number; y: number } | undefined =>
    placed.get(id) ?? nodeLayouts[id];

  const absolute = (id: string): { x: number; y: number } | undefined => {
    let position = relative(id);
    if (!position) return undefined;
    let parentId = components[id]?.parentId;
    const seen = new Set<string>([id]);
    while (parentId && !seen.has(parentId) && components[parentId]) {
      seen.add(parentId);
      const parent = relative(parentId);
      if (!parent) break;
      position = { x: position.x + parent.x, y: position.y + parent.y };
      parentId = components[parentId]?.parentId;
    }
    return position;
  };

  const boxOf = (id: string): Box | undefined => {
    const position = relative(id);
    return position ? { ...position, ...sizeOf(id, nodeLayouts, measured) } : undefined;
  };

  /** The fixed (or already placed) neighbour to sit next to, and on which side. */
  const anchorOf = (id: string): { anchorId: string; side: "right" | "left" } | undefined => {
    const ready = (other: string) => other !== id && (!dirty.has(other) || placed.has(other));
    const sorted = Object.values(connections).sort((a, b) => a.id.localeCompare(b.id));
    const incoming = sorted.find((c) => c.targetId === id && ready(c.sourceId));
    if (incoming) return { anchorId: incoming.sourceId, side: "right" };
    const outgoing = sorted.find((c) => c.sourceId === id && ready(c.targetId));
    if (outgoing) return { anchorId: outgoing.targetId, side: "left" };
    return undefined;
  };

  const ancestorsOf = (id: string): string[] => {
    const chain: string[] = [];
    let parentId = components[id]?.parentId;
    while (parentId && components[parentId] && !chain.includes(parentId)) {
      chain.push(parentId);
      parentId = components[parentId]?.parentId;
    }
    return chain;
  };

  /**
   * Everything the element must not land on, in absolute coordinates: every
   * other element and container, except the containers it sits in and what it
   * holds itself. Checking only its siblings let an element inside one panel
   * spill over the panel's edge onto the next one.
   */
  const obstaclesOf = (id: string): Box[] => {
    const ancestors = new Set(ancestorsOf(id));
    const boxes: Box[] = [];
    for (const other of Object.values(components)) {
      if (other.id === id || ancestors.has(other.id) || isTextType(other.type)) continue;
      if (ancestorsOf(other.id).includes(id)) continue;
      if (dirty.has(other.id) && !placed.has(other.id)) continue;
      const position = absolute(other.id);
      if (position) boxes.push({ ...position, ...sizeOf(other.id, nodeLayouts, measured) });
    }
    return boxes;
  };

  /** Container sizes grown to hold what was placed in them. */
  const grown = new Map<string, { width: number; height: number }>();
  const containerSize = (id: string) => grown.get(id) ?? sizeOf(id, nodeLayouts, measured);

  /** A container keeps what was placed inside it: grow each one up the chain to fit. */
  const growContainers = (id: string): void => {
    let childId = id;
    for (const parentId of ancestorsOf(id)) {
      const child = relative(childId);
      if (!child) return;
      const childSize = grown.get(childId) ?? sizeOf(childId, nodeLayouts, measured);
      const size = containerSize(parentId);
      const width = Math.max(size.width, Math.round(child.x + childSize.width + rowGap));
      const height = Math.max(size.height, Math.round(child.y + childSize.height + rowGap));
      if (width === size.width && height === size.height) return;
      grown.set(parentId, { width, height });
      childId = parentId;
    }
  };

  const placeOne = (id: string): boolean => {
    const anchor = anchorOf(id);
    if (!anchor) return false;
    const anchorAbs = absolute(anchor.anchorId);
    const anchorBox = boxOf(anchor.anchorId);
    const ownAbs = absolute(id);
    const ownRel = relative(id);
    if (!anchorAbs || !anchorBox || !ownAbs || !ownRel) return false;
    const size = sizeOf(id, nodeLayouts, measured);

    // Work in the element's parent coordinates: absolute target minus the
    // parent's absolute origin (own absolute minus own relative).
    const originX = ownAbs.x - ownRel.x;
    const originY = ownAbs.y - ownRel.y;
    let x =
      anchor.side === "right"
        ? anchorAbs.x + anchorBox.width + columnGap - originX
        : anchorAbs.x - columnGap - size.width - originX;
    let y = anchorAbs.y + anchorBox.height / 2 - size.height / 2 - originY;
    // Inside a container, never past its left or top edge.
    if (components[id]?.parentId) {
      x = Math.max(x, rowGap);
      y = Math.max(y, rowGap);
    }

    const obstacles = obstaclesOf(id);
    for (let guard = 0; guard < 200; guard += 1) {
      const candidate = { x: x + originX, y: y + originY, ...size };
      const blocker = obstacles.find((box) => overlaps(candidate, box, rowGap / 2));
      if (!blocker) break;
      y = blocker.y + blocker.height + rowGap - originY;
    }

    placed.set(id, { x: Math.round(x), y: Math.round(y) });
    growContainers(id);
    return true;
  };

  // Chains (an element added together with what it connects to) are placed
  // from the fixed side outwards.
  const pending = [...dirty].sort();
  let progress = true;
  while (progress && pending.length > 0) {
    progress = false;
    for (let index = 0; index < pending.length; index += 1) {
      if (placeOne(pending[index]!)) {
        pending.splice(index, 1);
        index -= 1;
        progress = true;
      }
    }
  }

  const placements: AppliedLayout[] = [...placed].map(([elementId, { x, y }]) => ({
    elementId,
    x,
    y,
  }));
  for (const [elementId, size] of grown) {
    const position = relative(elementId);
    if (position) placements.push({ elementId, x: position.x, y: position.y, ...size });
  }
  return placements;
}

/**
 * The elements a structural edit asks the automatic mode to place: what was
 * added, what moved into another container, and an element that had no
 * connection and just got its first one (added first, connected after).
 */
export function dirtyAfterEdit(
  before: { components: Record<string, Component>; connections: Record<string, Connection> },
  after: { components: Record<string, Component>; connections: Record<string, Connection> },
): string[] {
  const dirty = new Set<string>();
  for (const component of Object.values(after.components)) {
    if (isTextType(component.type)) continue;
    const previous = before.components[component.id];
    if (!previous || (previous.parentId ?? null) !== (component.parentId ?? null)) {
      dirty.add(component.id);
    }
  }

  const connectedBefore = new Set<string>();
  for (const connection of Object.values(before.connections)) {
    connectedBefore.add(connection.sourceId);
    connectedBefore.add(connection.targetId);
  }
  // An element that was on its own and just got connected goes next to the
  // other end. When both ends were on their own — the first connection of a
  // sketch — the target goes after the source: that is the reading direction.
  const loose = (id: string) => before.components[id] !== undefined && !connectedBefore.has(id);
  for (const connection of Object.values(after.connections)) {
    if (before.connections[connection.id]) continue;
    const { sourceId, targetId } = connection;
    if (loose(targetId) && !dirty.has(sourceId)) dirty.add(targetId);
    else if (loose(sourceId) && !loose(targetId) && !dirty.has(targetId)) dirty.add(sourceId);
  }
  return [...dirty].sort();
}
