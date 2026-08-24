import { useDiagramStore } from "@/features/diagram";
import {
  buildAslImportPlan,
  parseAslDocuments,
  validateAslDocuments,
  type AslImportPlan,
  type AslIssue,
} from "@/lib/asl";
import { layoutGraph } from "../layout/graphLayoutEngine";
import { resolveLabelPositions } from "./spread-edge-labels";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { buildAslGraphInputs, toLayoutGraph } from "./asl-plan-to-graph";

/**
 * ASL import: file text in, one undoable canvas mutation out.
 *
 * The pipeline is parse -> validate -> plan -> layout -> store. Structural
 * problems stop it before anything is written; everything else — an unexpected
 * provider, a kind with no visual counterpart — becomes a warning and the
 * import goes through, because a document that still describes a diagram
 * should still draw one.
 */

/** Margin from the top-left of the visible canvas area, in flow units. */
const VIEWPORT_MARGIN = 80;

export type AslImportOutcome =
  | {
      ok: true;
      componentIds: string[];
      connectionIds: string[];
      /** Non-fatal findings, reported by the caller through i18n. */
      warnings: AslIssue[];
    }
  | { ok: false; reason: "invalid"; issues: AslIssue[] }
  | { ok: false; reason: "no-active-diagram" };

/**
 * Flow coordinates of the current top-left corner of the canvas, so an imported
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

/** Parses and validates ASL text into the neutral plan. No canvas involved. */
export async function planAslImport(
  source: string,
): Promise<{ ok: true; plan: AslImportPlan } | { ok: false; issues: AslIssue[] }> {
  const parsed = await parseAslDocuments(source);
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues };
  }

  const validated = validateAslDocuments(parsed.documents);
  if (!validated.ok) {
    return { ok: false, issues: validated.issues };
  }

  const plan = buildAslImportPlan(validated.manifests);
  return { ok: true, plan };
}

/**
 * Lays the plan out with ELK and writes it to the active diagram as a single
 * undoable mutation, then selects what was imported — the same shape every
 * other insert-then-select flow has (C4 shortcuts, Pattern Picker, Mermaid and
 * draw.io import, IR generation).
 */
export async function importAslIntoActiveDiagram(source: string): Promise<AslImportOutcome> {
  const planned = await planAslImport(source);
  if (!planned.ok) {
    return { ok: false, reason: "invalid", issues: planned.issues };
  }

  const store = useDiagramStore.getState();
  if (store.activeDiagramId === null) {
    return { ok: false, reason: "no-active-diagram" };
  }

  const { plan } = planned;
  const graph = toLayoutGraph(plan);
  const { boxes, absoluteBoxes, parentOf } = await layoutGraph(graph.nodes, graph.edges);

  // Container ids from the layout graph: a node is a leaf for label-obstacle
  // purposes iff it has no children AND is not a container.
  const containerIds = new Set(graph.nodes.filter((n) => n.isContainer).map((n) => n.id));

  // Resolve label positions before writing to the store: two edges that share
  // a midpoint need different positions, and `labelPosition` on the connection
  // is the canvas's own answer to that problem.
  const labels = new Map(plan.edges.map((edge) => [edge.key, edge.label]));
  const labelPositions = resolveLabelPositions({
    absoluteBoxes,
    parentOf,
    containerIds,
    edges: plan.edges.map((edge) => ({
      id: edge.key,
      sourceId: edge.sourceKey,
      targetId: edge.targetKey,
    })),
    labels,
  });

  const origin = currentViewportOrigin();
  const { nodes, edges } = buildAslGraphInputs(plan, boxes, origin, labelPositions);

  // Intent, description and transport travel with the edge inputs rather than
  // as a follow-up patch: `updateConnection` pushes its own history entry, and
  // an import has to stay one undo step.
  const result = useDiagramStore.getState().insertGeneratedGraph(nodes, edges);

  if (result.componentIds.length > 0) {
    const selection = useCanvasSelectionStore.getState();
    selection.setSelectedNodeId(result.componentIds[0] ?? null);
    selection.setSelectedNodeIds(new Set(result.componentIds));
    selection.setSelectedEdgeId(null);
  }

  return {
    ok: true,
    componentIds: result.componentIds,
    connectionIds: result.connectionIds,
    warnings: plan.warnings,
  };
}
