import {
  useDiagramStore,
  type GeneratedEdgeInput,
  type GeneratedNodeInput,
} from "@/features/diagram";
import { layout } from "@/features/canvas/layout/layoutEngine";
import { applyLayoutResultEdges } from "@/features/canvas/layout/applyLayoutResult";
import type { LayoutBox } from "@/features/canvas/layout/contract";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { mapNodeToComponent } from "./ir-to-component";
import { irToLayoutGraph } from "./ir-to-layout-graph";
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
  boxes: Map<string, LayoutBox>,
  origin: { x: number; y: number },
): GeneratedGraphInputs {
  const nodes: GeneratedNodeInput[] = ir.nodes.map((node, index): GeneratedNodeInput => {
    const mapped = mapNodeToComponent(node);
    const box: LayoutBox | undefined = boxes.get(node.id);
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
 * Lays the IR out with ELK and writes the result to the active diagram as a
 * single undoable mutation.
 */
export async function applyIRToDiagram(ir: DiagramIR): Promise<ApplyIRResult> {
  const graph = irToLayoutGraph(ir);
  const layoutResult = await layout(graph);
  const origin = currentViewportOrigin();
  const { nodes, edges } = buildGeneratedGraphInputs(ir, layoutResult.boxes, origin);

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

  // The one thing this path has that the other four do not: the layout graph is
  // keyed by IR ids, while the store just minted ids of its own. Both maps are
  // built here, in one place, and handed to the unified applicator as a
  // translation — the previous revision spread the same mapping across a
  // handle-order loop and a waypoint loop that could drift apart.
  //
  // Edge ids pair by index because `insertGeneratedGraph` returns
  // `connectionIds` in the order it received `edges`, which is `ir.edges` order
  // (see `buildGeneratedGraphInputs`).
  const connectionIdByEdgeId = new Map<string, string>();
  ir.edges.forEach((edge, index) => {
    const connectionId = result.connectionIds[index];
    if (connectionId !== undefined) connectionIdByEdgeId.set(edge.id, connectionId);
  });

  // ELK's handle ordering and bend points, through the same applicator every
  // other layout consumer uses. `waypointOffset` is the viewport origin: the
  // routes come back anchored at (0,0) and the diagram was inserted where the
  // user is looking.
  applyLayoutResultEdges(graph, layoutResult, store.activeDiagramId, {
    waypointOffset: origin,
    idMap: {
      node: (irNodeId) => result.componentIdByExternalId[irNodeId],
      edge: (irEdgeId) => connectionIdByEdgeId.get(irEdgeId),
    },
  });

  return { componentIds: result.componentIds, connectionIds: result.connectionIds };
}
