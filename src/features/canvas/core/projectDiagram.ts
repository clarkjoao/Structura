import type { CSSProperties } from "react";
import type { Edge, Node } from "@xyflow/react";
import { isApiGroupComponent } from "@/features/diagram/model/component.guards";
import { isEndpointType } from "@/features/diagram/model/component-type-constants";
import { buildEdge, type EdgeBuildParams } from "../edges/data/buildEdges";
import type { NodeBuildContext, NodeTypeDescriptor } from "../nodes/node-types/types";
import type { DiagramSurfacePolicy } from "./canvasInteractionPolicy";
import type { ViewNode, ViewSnapshot } from "./resolveViewSnapshot";

/*
 * The whole projection, Diagram view → React Flow arrays, as one pure step.
 *
 * `resolveViewSnapshot` decides what is shown (scene, placement, nesting,
 * z-index, hiding, order); this turns that into nodes and edges with the
 * element descriptors' `buildData` / `buildStyle` and `buildEdge`. What only
 * the editor has — selection, compare mode, tag filter, pending LLM previews,
 * coverage dimming, locks — is not here: it is applied on top, as overlays, by
 * `useCanvasNodes` / `useCanvasEdges`, and an overlay may only add style,
 * classes and interaction restrictions. Position, size, z-index, order and
 * edge geometry are decided here and nowhere else, which is what makes "same
 * diagram → same picture" a property of the code rather than a rule to keep.
 * See docs/investigation/divergencia-edicao-visualizacao.md §5.1 (slice 5).
 *
 * Pure: model, utils and leaf modules only — no store, LLM, collaboration or
 * React Flow at runtime (`resolveViewSnapshot.test.ts` walks the imports). The
 * element registry is handed in (`describe`), and so are the handle
 * assignments, which come from the registry's handle specs.
 *
 * The identity caches stay with the hooks: this returns fresh objects every
 * call, and the callers decide which of them React Flow gets to keep.
 */

/** The element registry's lookup — `resolveNodeDescriptor` in the app. */
export type DescribeNodeFully = (component: ViewNode["component"]) => NodeTypeDescriptor;

export interface EdgeHandleAssignment {
  connId: string;
  sourceHandle: string;
  targetHandle: string;
}

/** What `buildEdge` reads of a canvas: the diagram and the reading being played, if any. */
export type EdgeProjectionContext = Pick<
  EdgeBuildParams,
  | "diagram"
  | "isPlaying"
  | "isRecording"
  | "activeStep"
  | "flowHighlight"
  | "flowBadges"
  | "coverage"
>;

export interface ProjectionDeps {
  describe: DescribeNodeFully;
  handleAssignments: readonly EdgeHandleAssignment[];
}

/**
 * An endpoint inside an API group is laid out by its group; the author moves
 * the group, not the endpoint. A structural rule of the editor's base, not a
 * mode — which is why it is here and not an overlay.
 */
function isLockedInGroup(viewNode: ViewNode, components: ViewSnapshot["components"]): boolean {
  const { component } = viewNode;
  if (!isEndpointType(component.type) || component.parentId == null) return false;
  const parent = components[component.parentId];
  return parent !== undefined && isApiGroupComponent(parent);
}

function projectNode(
  viewNode: ViewNode,
  view: ViewSnapshot,
  ctx: NodeBuildContext,
  policy: DiagramSurfacePolicy,
  describe: DescribeNodeFully,
): Node {
  const { component, layout } = viewNode;
  const descriptor = describe(component);
  const common = {
    id: component.id,
    type: descriptor.rfType,
    position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    zIndex: viewNode.zIndex,
    ...(viewNode.isChild ? { parentId: component.parentId!, extent: "parent" as const } : {}),
    hidden: viewNode.isHidden,
    data: descriptor.buildData(component, ctx) as Record<string, unknown>,
  };

  if (policy.kind === "read") {
    return {
      ...common,
      draggable: false,
      selectable: false,
      connectable: false,
      style: descriptor.buildStyle?.(component, ctx),
    };
  }

  const lockedInGroup = isLockedInGroup(viewNode, view.components);
  return {
    ...common,
    connectable: descriptor.connectable,
    selected: false,
    draggable: descriptor.draggable ?? !lockedInGroup,
    selectable: descriptor.selectable ?? !lockedInGroup,
    focusable: descriptor.focusable ?? !lockedInGroup,
    className: undefined,
    ...(descriptor.dragHandle ? { dragHandle: descriptor.dragHandle } : {}),
    // Always an object on the editor path: overlays write opacity into it.
    style: { ...descriptor.buildStyle?.(component, ctx) } as CSSProperties,
  };
}

/** Every shown node, in the view's render order. */
export function projectNodes(
  view: ViewSnapshot,
  ctx: NodeBuildContext,
  policy: DiagramSurfacePolicy,
  describe: DescribeNodeFully,
): Node[] {
  return view.nodes.map((viewNode) => projectNode(viewNode, view, ctx, policy, describe));
}

/**
 * Every shown edge, in connection order. The viewer (`read`) stamps each edge
 * with its waypoints from `diagram.edgeLayouts`; the editor reads them from
 * the store (until slice 6).
 */
export function projectEdges(
  view: ViewSnapshot,
  ctx: EdgeProjectionContext,
  policy: DiagramSurfacePolicy,
  handleAssignments: readonly EdgeHandleAssignment[],
): Edge[] {
  const assignmentById = new Map(handleAssignments.map((entry) => [entry.connId, entry]));
  const reading = policy.kind === "read";
  return view.shownConnections.map((connection) => {
    const edge = buildEdge(connection, assignmentById.get(connection.id), {
      diagram: ctx.diagram,
      selectedEdgeId: null,
      isPlaying: ctx.isPlaying,
      isRecording: ctx.isRecording,
      isCompareMode: false,
      activeStep: ctx.activeStep,
      flowHighlight: ctx.flowHighlight,
      flowBadges: ctx.flowBadges,
      coverage: ctx.coverage,
      tagFilterEdgeDimmed: false,
      // Links shared before `edgeLayouts` existed arrive without it; an empty
      // map still stamps every edge, so none falls back to the store.
      ...(reading ? { edgeLayouts: ctx.diagram.edgeLayouts ?? {} } : {}),
    });
    return reading ? { ...edge, selectable: false } : edge;
  });
}

/**
 * The full projection: `projectNodes` + `projectEdges` over one view.
 *
 * The viewer calls this. The editor calls the two halves from the two hooks
 * that own them (`useCanvasNodes`, `useCanvasEdges`), which memoise on
 * different inputs — calling the whole from both would build every edge on a
 * selection change and every node on an edge selection.
 *
 * @example
 * const view = resolveViewSnapshot(diagram, { sceneId: null }, resolveNodeDescriptor);
 * const { nodes, edges } = projectDiagram(view, ctx, readPolicy(), {
 *   describe: resolveNodeDescriptor,
 *   handleAssignments,
 * });
 */
export function projectDiagram(
  view: ViewSnapshot,
  ctx: NodeBuildContext,
  policy: DiagramSurfacePolicy,
  deps: ProjectionDeps,
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: projectNodes(view, ctx, policy, deps.describe),
    edges: projectEdges(view, ctx, policy, deps.handleAssignments),
  };
}
