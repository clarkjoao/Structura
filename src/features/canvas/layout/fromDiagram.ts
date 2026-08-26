// Leaf imports, not the `@/features/diagram` barrel: that barrel re-exports the
// Zustand store, and nothing on the layout path should drag the store into its
// import graph.
import { isPanelType } from "@/features/diagram/model/component-type-constants";
import {
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  PANEL_DEFAULT_H,
  PANEL_DEFAULT_W,
} from "@/features/diagram/model/layout.constants";
import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import type { NodeLayout } from "@/features/diagram/model/layout.types";
import type { LayoutGraph, LayoutNode } from "./contract";

export interface FromDiagramOptions {
  /**
   * Limit the graph to these components and everything nested under them.
   * Omitted, the whole diagram is laid out.
   */
  rootIds?: readonly string[];
  /** Sizes read off the rendered canvas, when the caller has them. */
  measured?: ReadonlyMap<string, { width: number; height: number }>;
}

/**
 * The size to hand ELK for a component.
 *
 * A stored layout wins over a measured one, matching what the canvas draws: a
 * node the user resized keeps that size. A container's size barely matters —
 * ELK recomputes it from its children — but an empty one keeps whatever it is
 * given, which is why a panel falls back to the panel default rather than the
 * leaf default.
 */
function sizeOf(
  component: Component,
  nodeLayouts: Record<string, NodeLayout>,
  measured: FromDiagramOptions["measured"],
): { width: number; height: number } {
  const stored = nodeLayouts[component.id];
  if (
    stored?.width !== undefined &&
    stored.height !== undefined &&
    stored.width > 0 &&
    stored.height > 0
  ) {
    return { width: stored.width, height: stored.height };
  }

  const measuredSize = measured?.get(component.id);
  if (measuredSize && measuredSize.width > 0 && measuredSize.height > 0) {
    return measuredSize;
  }

  if (isPanelType(component.type)) {
    return { width: PANEL_DEFAULT_W, height: PANEL_DEFAULT_H };
  }
  return { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H };
}

/** `rootIds` plus every component nested under them, at any depth. */
function collectSubtree(
  components: Record<string, Component>,
  rootIds: readonly string[],
): Set<string> {
  const childIdsByParent = new Map<string, string[]>();
  for (const component of Object.values(components)) {
    const parentId = component.parentId;
    if (parentId === null || parentId === undefined) continue;
    const siblings = childIdsByParent.get(parentId);
    if (siblings) siblings.push(component.id);
    else childIdsByParent.set(parentId, [component.id]);
  }

  const included = new Set<string>();
  const visit = (id: string): void => {
    if (included.has(id) || components[id] === undefined) return;
    included.add(id);
    for (const childId of childIdsByParent.get(id) ?? []) {
      visit(childId);
    }
  };
  for (const id of rootIds) visit(id);

  return included;
}

/**
 * Builds a layout graph from the diagram's own types.
 *
 * Every component in scope goes in — including notes, and including components
 * with no connections at all. Filtering those out is what made the old engine
 * silently drop nodes and do nothing on a diagram with no edges.
 */
export function fromDiagram(
  components: Record<string, Component>,
  connections: readonly Connection[],
  nodeLayouts: Record<string, NodeLayout>,
  options: FromDiagramOptions = {},
): LayoutGraph {
  const included =
    options.rootIds === undefined
      ? new Set(Object.keys(components))
      : collectSubtree(components, options.rootIds);

  const nodes: LayoutNode[] = [];
  for (const id of included) {
    const component = components[id];
    if (component === undefined) continue;
    const { width, height } = sizeOf(component, nodeLayouts, options.measured);
    nodes.push({ id, parentId: component.parentId ?? null, width, height });
  }

  const edges = connections
    .filter((connection) => included.has(connection.sourceId) && included.has(connection.targetId))
    .map((connection) => ({
      id: connection.id,
      sourceId: connection.sourceId,
      targetId: connection.targetId,
    }));

  return { nodes, edges };
}

/**
 * Ids whose size the caller should write back after a layout.
 *
 * Only panels: their box has to hold their children, and the canvas reads a
 * panel's size from the stored layout (`panel.descriptor.ts`). Every other node
 * type sizes itself from its own content, so writing a layout size would pin it
 * to something the DOM never agreed to.
 */
export function resizableIds(
  graph: LayoutGraph,
  components: Record<string, Component>,
): Set<string> {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    const component = components[node.id];
    if (component !== undefined && isPanelType(component.type)) ids.add(node.id);
  }
  return ids;
}
