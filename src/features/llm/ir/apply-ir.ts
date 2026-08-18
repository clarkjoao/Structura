import {
  generateId,
  useDiagramStore,
  type GeneratedEdgeInput,
  type GeneratedNodeInput,
} from "@/features/diagram";
import { layoutIR, type IRLayoutBox } from "@/features/canvas/layout/irLayoutEngine";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { isApplyElkHandleOrderEnabled, isApplyElkWaypointsEnabled } from "./ir-layout-flags";
import { mapNodeToComponent } from "./ir-to-component";
import type { DiagramIR } from "./ir.types";

/** Margin from the top-left of the visible canvas area, in flow units. */
const VIEWPORT_MARGIN = 80;

export interface ApplyIRResult {
  componentIds: string[];
  connectionIds: string[];
}

/**
 * Flow coordinates of the current top-left corner of the canvas, so a generated
 * diagram lands where the user is actually looking instead of at the origin.
 */
function currentViewportOrigin(): { x: number; y: number } {
  const state = useDiagramStore.getState();
  const diagramId = state.activeDiagramId;
  const viewport = diagramId ? state.diagrams[diagramId]?.viewport : undefined;
  if (!viewport) {
    return { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN };
  }
  const zoom = viewport.zoom > 0 ? viewport.zoom : 1;
  return {
    x: -viewport.x / zoom + VIEWPORT_MARGIN,
    y: -viewport.y / zoom + VIEWPORT_MARGIN,
  };
}

export interface GeneratedGraphInputs {
  nodes: GeneratedNodeInput[];
  edges: GeneratedEdgeInput[];
}

/**
 * Turns a laid-out IR into store input. Pure: everything that depends on the
 * store or on ELK is resolved by the caller.
 */
export function buildGeneratedGraphInputs(
  ir: DiagramIR,
  boxes: Map<string, IRLayoutBox>,
  origin: { x: number; y: number },
): GeneratedGraphInputs {
  const nodes: GeneratedNodeInput[] = ir.nodes.map((node, index): GeneratedNodeInput => {
    const mapped = mapNodeToComponent(node);
    const box: IRLayoutBox | undefined = boxes.get(node.id);
    const isRoot = node.parentId === null;

    // Root positions are canvas-absolute, child positions are relative to the
    // parent — the same convention React Flow uses, and what ELK hands back.
    const x = (box?.x ?? index * 240) + (isRoot ? origin.x : 0);
    const y = (box?.y ?? 0) + (isRoot ? origin.y : 0);

    return {
      externalId: node.id,
      type: mapped.type,
      name: node.name,
      parentExternalId: node.parentId,
      ...(mapped.panelKind !== undefined ? { panelKind: mapped.panelKind } : {}),
      ...(mapped.awsService !== undefined ? { awsService: mapped.awsService } : {}),
      ...(node.technology !== undefined ? { technology: node.technology } : {}),
      x,
      y,
      // Only panels are sized from the layout: their box has to hold the
      // children. Leaf nodes keep their intrinsic DOM size.
      ...(mapped.type === "panel" && box !== undefined
        ? { width: box.width, height: box.height }
        : {}),
    };
  });

  const edges: GeneratedEdgeInput[] = ir.edges.map((edge) => ({
    sourceExternalId: edge.sourceId,
    targetExternalId: edge.targetId,
    label: edge.label ?? "",
  }));

  return { nodes, edges };
}

/**
 * Interior bend points of an ELK route, moved into canvas coordinates.
 *
 * The first and last entries sit on the node borders; the canvas draws those
 * legs from the node handles instead, so only what is between them becomes
 * control points.
 */
export function interiorWaypoints(
  route: Array<{ x: number; y: number }>,
  origin: { x: number; y: number },
): Array<{ x: number; y: number }> {
  if (route.length <= 2) return [];
  return route.slice(1, -1).map((point) => ({ x: point.x + origin.x, y: point.y + origin.y }));
}

/**
 * Lays the IR out with ELK and writes the result to the active diagram as a
 * single undoable mutation.
 */
export async function applyIRToDiagram(ir: DiagramIR): Promise<ApplyIRResult> {
  const { boxes, edgeRoutes, handleOrder } = await layoutIR(ir);
  const origin = currentViewportOrigin();
  const { nodes, edges } = buildGeneratedGraphInputs(ir, boxes, origin);

  const store = useDiagramStore.getState();
  const result = store.insertGeneratedGraph(nodes, edges);

  if (result.componentIds.length > 0) {
    // Select what was just generated, matching every other insert-then-select
    // flow (C4 shortcuts, Pattern Picker, Mermaid/drawio import).
    const selection = useCanvasSelectionStore.getState();
    selection.setSelectedNodeId(result.componentIds[0] ?? null);
    selection.setSelectedNodeIds(new Set(result.componentIds));
    selection.setSelectedEdgeId(null);
  }

  const connectionIdByEdgeId = new Map<string, string>();
  ir.edges.forEach((edge, index) => {
    const connectionId = result.connectionIds[index];
    if (connectionId !== undefined) connectionIdByEdgeId.set(edge.id, connectionId);
  });

  if (isApplyElkHandleOrderEnabled()) {
    // `handleOrder` is the field the canvas already consults (and that the
    // reorder controls write to), so this is the same mechanism a user gets by
    // reordering by hand — not a second, parallel notion of handle choice.
    for (const side of ["outgoing", "incoming"] as const) {
      for (const [irNodeId, edgeIds] of handleOrder[side]) {
        const componentId = result.componentIdByExternalId[irNodeId];
        if (componentId === undefined) continue;
        const orderedConnectionIds = edgeIds
          .map((edgeId) => connectionIdByEdgeId.get(edgeId))
          .filter((connectionId): connectionId is string => connectionId !== undefined);
        if (orderedConnectionIds.length === 0) continue;
        useDiagramStore.getState().updateHandleOrder(componentId, side, orderedConnectionIds);
      }
    }
  }

  if (isApplyElkWaypointsEnabled()) {
    const diagramId = store.activeDiagramId;
    if (diagramId !== null) {
      ir.edges.forEach((edge) => {
        const connectionId = connectionIdByEdgeId.get(edge.id);
        const route = edgeRoutes.get(edge.id);
        if (connectionId === undefined || route === undefined) return;

        const waypoints = interiorWaypoints(route, origin);
        if (waypoints.length === 0) return;

        useDiagramStore.getState().setEdgeControlPoints(
          diagramId,
          connectionId,
          waypoints.map((point) => ({ id: generateId("cp"), x: point.x, y: point.y })),
          // The generation already pushed its own history checkpoint.
          { history: false },
        );
      });
    }
  }

  return { componentIds: result.componentIds, connectionIds: result.connectionIds };
}
