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
import { layout } from "./layoutEngine";

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
  });

  const { graph, result, groups } = input.autoRefs
    ? await chooseAutoRefs(baseGraph, autoRefOptionsFor(components), layout)
    : { graph: baseGraph, result: await layout(baseGraph), groups: [] };

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
 */
export function applyDiagramAutoLayout(plan: DiagramAutoLayoutPlan, diagramId: string): void {
  useDiagramStore.getState().applyAutoLayout(plan.layouts, plan.autoRefs);
  applyLayoutResultEdges(plan.graph, plan.result, diagramId, { waypointOffset: plan.offset });
}

/**
 * Plans and applies the auto-layout on the active diagram as stored, the way
 * the assistant and generation run it: no measured sizes, references unless a
 * scene is active. Returns the plan, or `null` when there is nothing to lay out.
 */
export async function autoLayoutActiveDiagram(
  options: Pick<DiagramAutoLayoutInput, "offset"> = {},
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
    ...(options.offset ? { offset: options.offset } : {}),
  });
  if (plan.result.boxes.size === 0) return null;

  applyDiagramAutoLayout(plan, diagramId);
  return plan;
}
