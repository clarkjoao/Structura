import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import type { NodeLayout } from "@/features/diagram/model/layout.types";
import type { AutoRefAssignment } from "@/features/diagram/store/actions.types";
import { useDiagramStore } from "@/features/diagram";
import { fitContainersToChildren, toAppliedLayouts, type AppliedLayout } from "./applyLayout";
import { applyLayoutResultEdges } from "./applyLayoutResult";
import { chooseAutoRefs, type AutoRefGroup } from "./autoRefs";
import { autoRefOptionsFor, withoutAutoRefs } from "./autoRefsFromDiagram";
import type { LayoutGraph, LayoutResult } from "./contract";
import { fitToContentIds, fromDiagram, resizableIds } from "./fromDiagram";
import { layoutWithSettings } from "./layoutEngine";
import type { DiagramLayoutSettings } from "@/features/diagram/model/layout-settings";
import type { DiagramDirection } from "@/features/diagram/model/diagram.types";
import { isTopToBottom, transposeGraph, transposeResult } from "./axis";
import { handleSpecFor } from "../nodes/node-types/registry";

/**
 * The whole-diagram auto-layout, in one place.
 *
 * Cmd/Ctrl+Shift+L, the assistant's AUTO_LAYOUT tool and a freshly generated
 * diagram all run this, so a diagram reads the same whichever way it was laid
 * out — and the viewer, which draws what was saved, shows exactly that.
 *
 *   1. automatic references from the last run are folded back into their
 *      originals (what the last run drew is not an input to the next one);
 *   2. `fromDiagram` builds the graph, edge labels included;
 *   3. `chooseAutoRefs` keeps the references that make it read better;
 *   4. every container is wrapped the way "Fit to content" leaves it.
 *
 * Planning is pure; `applyDiagramAutoLayout` writes the plan to the store.
 */

export interface DiagramAutoLayoutInput {
  components: Record<string, Component>;
  connections: readonly Connection[];
  nodeLayouts: Record<string, NodeLayout>;
  /** Sizes React Flow measured; absent offline (generation, seeds). */
  measured?: ReadonlyMap<string, { width: number; height: number }>;
  /**
   * Whether references may be made or dissolved. Off in a scene, which adds and
   * removes elements through its own diff and is laid out as it is.
   */
  autoRefs: boolean;
  /**
   * Where the layout's origin lands on the canvas. The button lays out at the
   * origin and then fits the view; generation places the result where the
   * user is looking.
   */
  offset?: { x: number; y: number };
  /**
   * The diagram's layout settings (density, gaps). Absent runs the tuned
   * spacing unchanged. References are chosen under the same spacing, so the
   * choice is measured against the layout that will be drawn.
   */
  settings?: DiagramLayoutSettings;
  /**
   * The axis to lay out along (ADR-0013). Absent is left-to-right. A
   * top-to-bottom plan runs the whole left-to-right pipeline — references
   * included — on the mirrored graph (`axis.ts`).
   */
  direction?: DiagramDirection;
}

export interface DiagramAutoLayoutPlan {
  graph: LayoutGraph;
  result: LayoutResult;
  groups: AutoRefGroup[];
  /** Positions, with container sizes, ready for `applyAutoLayout`. */
  layouts: AppliedLayout[];
  /** The references to reconcile; `undefined` leaves references alone. */
  autoRefs: AutoRefAssignment[] | undefined;
  offset: { x: number; y: number };
  /** The settings the plan was made with, for the caller that writes them. */
  settings: DiagramLayoutSettings | undefined;
  /** The axis the plan was laid out on; its edges are written on the same one. */
  direction: DiagramDirection;
}

export async function planDiagramAutoLayout(
  input: DiagramAutoLayoutInput,
): Promise<DiagramAutoLayoutPlan> {
  const { components, connections, nodeLayouts, measured } = input;
  const offset = input.offset ?? { x: 0, y: 0 };
  const planned = input.autoRefs
    ? withoutAutoRefs(components, connections)
    : { components, connections: [...connections] };
  const baseGraph = fromDiagram(planned.components, planned.connections, nodeLayouts, {
    ...(measured ? { measured } : {}),
    handleSpecFor,
  });

  const direction = input.direction ?? "LR";
  const mirrored = isTopToBottom(direction);
  const run = layoutWithSettings(input.settings);
  const laidOut = mirrored ? transposeGraph(baseGraph) : baseGraph;
  const chosen = input.autoRefs
    ? await chooseAutoRefs(laidOut, autoRefOptionsFor(components), run)
    : { graph: laidOut, result: await run(laidOut), groups: [] };
  const { groups } = chosen;
  const graph = mirrored ? transposeGraph(chosen.graph) : chosen.graph;
  const result = mirrored ? transposeResult(chosen.result) : chosen.result;

  const layouts = fitContainersToChildren(
    toAppliedLayouts(graph, result, resizableIds(graph, components), offset),
    graph,
    fitToContentIds(graph, components),
  );

  return {
    graph,
    result,
    groups,
    layouts,
    offset,
    settings: input.settings,
    direction,
    autoRefs: input.autoRefs
      ? groups.map(({ refId, originalId, parentId, sourceIds }) => ({
          refId,
          originalId,
          parentId,
          sourceIds,
        }))
      : undefined,
  };
}

/**
 * Writes a plan to the active diagram: positions and references as one undo
 * step, then ELK's handle order and corridors.
 *
 * `writeSettings` stores the settings the plan was made with in that same step
 * — what a settings change from the Arrange menu does — and `writeDirection`
 * the axis it was laid out on (switching direction). Omitted, the diagram's
 * stored settings and direction are left as they are.
 */
export function applyDiagramAutoLayout(
  plan: DiagramAutoLayoutPlan,
  diagramId: string,
  {
    writeSettings = false,
    writeDirection = false,
  }: { writeSettings?: boolean; writeDirection?: boolean } = {},
): void {
  useDiagramStore.getState().applyAutoLayout(plan.layouts, plan.autoRefs, {
    ...(writeSettings && { layoutSettings: plan.settings ?? {} }),
    ...(writeDirection && { direction: plan.direction }),
  });
  applyLayoutResultEdges(plan.graph, plan.result, diagramId, {
    waypointOffset: plan.offset,
    direction: plan.direction,
  });
}

/**
 * Plans and applies the auto-layout on the active diagram as stored, the way
 * the assistant and generation run it: no measured sizes, references unless a
 * scene is active. Returns the plan, or `null` when there is nothing to lay out.
 */
export async function autoLayoutActiveDiagram(
  options: Pick<DiagramAutoLayoutInput, "offset"> & {
    /**
     * Lay out along this axis and store it as the diagram's, in the same step —
     * a generation that is the whole diagram and asks for its own direction.
     */
    direction?: DiagramDirection;
  } = {},
): Promise<DiagramAutoLayoutPlan | null> {
  const state = useDiagramStore.getState();
  const diagramId = state.activeDiagramId;
  const diagram = diagramId ? state.diagrams[diagramId] : undefined;
  if (!diagramId || !diagram) return null;

  const inScene = !!diagram.activeVersionId && !!diagram.versions?.[diagram.activeVersionId];
  const plan = await planDiagramAutoLayout({
    components: diagram.snapshot.components,
    connections: Object.values(diagram.snapshot.connections),
    nodeLayouts: diagram.nodeLayouts,
    autoRefs: !inScene,
    ...(diagram.layoutSettings ? { settings: diagram.layoutSettings } : {}),
    direction: options.direction ?? diagram.direction ?? "LR",
    ...(options.offset ? { offset: options.offset } : {}),
  });
  if (plan.result.boxes.size === 0) return null;

  applyDiagramAutoLayout(plan, diagramId, { writeDirection: options.direction !== undefined });
  return plan;
}
