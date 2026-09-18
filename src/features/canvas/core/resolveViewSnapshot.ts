import type {
  Component,
  Connection,
  Diagram,
  DiagramModel,
  NodeLayout,
} from "@/features/diagram/model";
import { isApiGroupComponent, isPanelComponent } from "@/features/diagram/model/component.guards";
import { placedComponents, placedConnections } from "@/features/diagram/utils/placement";
import { resolveCanvasSnapshot } from "@/features/diagram/utils/scene.utils";
import {
  getCachedCanvasSnapshot,
  type ResolvedSnapshot,
} from "@/features/diagram/utils/snapshot-cache";
import type { NodeTypeDescriptor } from "../nodes/node-types/types";

/*
 * Pure by construction: this module imports the diagram model and utils only —
 * no store, LLM, collaboration or React Flow. The one thing it needs from the
 * element registry, a node's descriptor, is handed in (`describe`), because
 * the registry is what reaches the store. `resolveViewSnapshot.test.ts` walks
 * the imports to keep it that way.
 */

/** What the view needs to know of a node's type: whether it nests, and its default z. */
export type ViewNodeDescriptor = Pick<NodeTypeDescriptor, "canHaveParent" | "zIndex">;
export type DescribeNode = (component: Component) => ViewNodeDescriptor;

/**
 * Which diagram is being looked at, and the only thing the two surfaces may
 * legitimately disagree on.
 *
 * The editor passes the scene the author has open (and the second one while
 * comparing two); a shared link passes `null`, because a link always opens on
 * the base scene.
 */
export interface ViewSnapshotOptions {
  sceneId: string | null;
  compareSceneId?: string | null;
}

/** One placed component, as the canvas shows it. */
export interface ViewNode {
  component: Component;
  layout: NodeLayout | undefined;
  /** `layout.zIndex` (bring to front / send to back) over the descriptor's default. */
  zIndex: number;
  /** Hidden itself, or under a collapsed or hidden panel. */
  isHidden: boolean;
  /** Nested inside its parent (the parent is a placed panel or API group). */
  isChild: boolean;
}

export interface ViewSnapshot {
  /** The scene-resolved components, placed or not — ancestry is read through these. */
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
  /** Placed panels and API groups: the only things a node can be nested in. */
  panelIds: Set<string>;
  collapsedPanelIds: Set<string>;
  /** Every placed component, in render order. Hidden ones stay, flagged. */
  nodes: ViewNode[];
  /** Connections with both ends placed — what handle counts and assignments are built from. */
  placedConnections: Connection[];
  /** The edges drawn: placed connections whose ends are not hidden. */
  shownConnections: Connection[];
}

/** What a canvas with no diagram shows. One shared object, so memos stay put. */
export const EMPTY_VIEW_SNAPSHOT: ViewSnapshot = Object.freeze({
  components: {},
  connections: {},
  nodeLayouts: {},
  panelIds: new Set<string>(),
  collapsedPanelIds: new Set<string>(),
  nodes: [],
  placedConnections: [],
  shownConnections: [],
});

/**
 * The scene the view shows.
 *
 * When the options name the scenes the diagram itself has open — always the
 * editor's case — this goes through `getCachedCanvasSnapshot`, so the editor
 * keeps the object identity its memos depend on. Any other request (a link
 * asking for the base while the author had a scene open) resolves fresh.
 */
export function resolveViewScene(
  diagram: Diagram | DiagramModel,
  options: ViewSnapshotOptions,
): ResolvedSnapshot {
  const sceneId = options.sceneId;
  const compareSceneId = options.compareSceneId ?? null;
  if (
    (diagram.activeSceneId ?? null) === sceneId &&
    (diagram.compareSceneId ?? null) === compareSceneId
  ) {
    return getCachedCanvasSnapshot(diagram);
  }
  return resolveCanvasSnapshot({ ...diagram, activeSceneId: sceneId, compareSceneId });
}

/** Containers a node can be nested in: panels and API groups. */
export function buildPanelIds(components: readonly Component[]): Set<string> {
  const ids = new Set<string>();
  for (const c of components) {
    if (isPanelComponent(c) || isApiGroupComponent(c)) ids.add(c.id);
  }
  return ids;
}

/** The edges drawn: a connection to a hidden component is not. */
export function filterVisibleConnections(
  connections: Connection[],
  components: Record<string, { hidden?: boolean }>,
): Connection[] {
  return connections.filter((conn) => {
    const src = components[conn.sourceId];
    const tgt = components[conn.targetId];
    return !src?.hidden && !tgt?.hidden;
  });
}

export function buildCollapsedPanelIds(components: Record<string, Component>): Set<string> {
  return new Set(
    Object.values(components)
      .filter((c) => isPanelComponent(c) && c.collapsed)
      .map((c) => c.id),
  );
}

function hasCollapsedOrHiddenAncestor(
  comp: Component,
  components: Record<string, Component>,
  collapsedPanelIds: Set<string>,
): boolean {
  let currentParentId = comp.parentId;
  while (currentParentId !== null && currentParentId !== undefined) {
    const parent = components[currentParentId];
    if (!parent) break;
    if (collapsedPanelIds.has(currentParentId)) return true;
    if (parent.hidden === true) return true;
    currentParentId = parent.parentId;
  }
  return false;
}

/**
 * Nesting, stacking and visibility of one node — the part of a node's state
 * that does not depend on who is selecting what. `computeNodeVisibility` (the
 * editor) adds the selection on top of this; the viewer uses it as is.
 */
export function resolveNodeView(
  comp: Component,
  descriptor: ViewNodeDescriptor,
  layout: { zIndex?: number } | undefined,
  panelIds: Set<string>,
  collapsedPanelIds: Set<string>,
  components: Record<string, Component>,
): { isChild: boolean; zIndex: number; isHidden: boolean } {
  const isChild = descriptor.canHaveParent && comp.parentId !== null && panelIds.has(comp.parentId);
  const zIndex =
    layout?.zIndex ??
    (typeof descriptor.zIndex === "function" ? descriptor.zIndex(comp) : descriptor.zIndex);
  const isHidden =
    comp.hidden === true || hasCollapsedOrHiddenAncestor(comp, components, collapsedPanelIds);
  return { isChild, zIndex, isHidden };
}

function parentDepth(comp: Component, components: Record<string, Component>): number {
  let depth = 0;
  let currentId = comp.parentId;
  const visited = new Set<string>();
  while (currentId && components[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    depth++;
    currentId = components[currentId].parentId;
  }
  return depth;
}

/**
 * Render order: containers (panels, API groups) first, then shallower before
 * deeper; ties keep insertion order.
 *
 * React Flow draws nodes in array order and never re-sorts by z-index, so
 * among nodes with equal z the later one is on top. Both surfaces must hand it
 * the same order, or two overlapping panels stack one way in the editor and
 * the other way in a shared link. This is the editor's order, adopted by the
 * viewer (decision recorded with slice 4 of
 * docs/investigation/divergencia-edicao-visualizacao.md). It also puts every
 * parent before its children, which React Flow requires.
 */
export function sortForRender(
  components: readonly Component[],
  componentsById: Record<string, Component>,
): Component[] {
  const depthCache = new Map<string, number>();
  const depthOf = (comp: Component): number => {
    const cached = depthCache.get(comp.id);
    if (cached !== undefined) return cached;
    const depth = parentDepth(comp, componentsById);
    depthCache.set(comp.id, depth);
    return depth;
  };
  return [...components].sort((a, b) => {
    const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
    const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
    if (aIsGroup && !bIsGroup) return -1;
    if (!aIsGroup && bIsGroup) return 1;
    const depthA = depthOf(a);
    const depthB = depthOf(b);
    if (depthA !== depthB) return depthA - depthB;
    return 0;
  });
}

/**
 * What the canvas shows of a diagram: which scene, which components and
 * connections, how each node is nested, stacked and hidden, and in what order
 * — one pure function for the editor and the viewer.
 *
 * Selection (dimming the unselected, rings) is not here: it is the editor's
 * overlay and sits on top of this. See
 * docs/investigation/divergencia-edicao-visualizacao.md §4-§5.
 *
 * The editor reaches the same answer through the steps exported above, at the
 * points where it already computes them — `placedComponents` in its store
 * selectors, `resolveNodeView` inside `computeNodeVisibility`, `sortForRender`
 * inside `useCanvasNodes` — so its memos and identity caches stay as they are.
 * `readWriteParity.test.tsx` holds the two to the same arrays.
 *
 * `describe` is the element registry's lookup (`resolveNodeDescriptor`),
 * passed in rather than imported so this stays free of the store; it is the
 * same for both surfaces, which is why it is not one of the `options`.
 *
 * @example
 * const view = resolveViewSnapshot(diagram, { sceneId: null }, resolveNodeDescriptor);
 * view.nodes.map((node) => node.component.id); // render order
 */
export function resolveViewSnapshot(
  diagram: Diagram | DiagramModel,
  options: ViewSnapshotOptions,
  describe: DescribeNode,
): ViewSnapshot {
  const resolved = resolveViewScene(diagram, options);
  const placed = placedComponents(resolved.components, resolved.nodeLayouts);
  const panelIds = buildPanelIds(placed);
  const collapsedPanelIds = buildCollapsedPanelIds(resolved.components);

  const nodes = sortForRender(placed, resolved.components).map((component): ViewNode => {
    const layout = resolved.nodeLayouts[component.id];
    const view = resolveNodeView(
      component,
      describe(component),
      layout,
      panelIds,
      collapsedPanelIds,
      resolved.components,
    );
    return { component, layout, ...view };
  });

  const connections = placedConnections(resolved.connections, resolved.nodeLayouts);

  return {
    components: resolved.components,
    connections: resolved.connections,
    nodeLayouts: resolved.nodeLayouts,
    panelIds,
    collapsedPanelIds,
    nodes,
    placedConnections: connections,
    shownConnections: filterVisibleConnections(connections, resolved.components),
  };
}
