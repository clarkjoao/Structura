import type { Flow, FlowStep } from "../model/flow.types";
import type { Diagram, SceneDiff } from "../model/diagram.types";
import { resolveSceneSnapshot } from "./scene.utils";

export function getStepById(flow: Flow, id: string): FlowStep | undefined {
  return flow.steps[id];
}

export function getNextSteps(flow: Flow, stepId: string): FlowStep[] {
  const step = flow.steps[stepId];
  if (!step) return [];

  if (step.branches && step.branches.length > 0) {
    return step.branches.map((b) => flow.steps[b.nextId]).filter((s): s is FlowStep => !!s);
  }

  if (step.next) {
    const next = flow.steps[step.next];
    return next ? [next] : [];
  }

  return [];
}

export function isConditionStep(step: FlowStep): boolean {
  return step.type === "condition" && !!step.branches && step.branches.length > 0;
}

export function getEntryStep(flow: Flow): FlowStep | undefined {
  if (flow.entryStepId) return flow.steps[flow.entryStepId];
  return undefined;
}

export function walkFlow(flow: Flow, visitor: (step: FlowStep) => void): void {
  const entry = getEntryStep(flow);
  if (!entry) return;

  const visited = new Set<string>();
  const stack: FlowStep[] = [entry];

  while (stack.length > 0) {
    const step = stack.pop()!;
    if (visited.has(step.id)) continue;
    visited.add(step.id);
    visitor(step);

    const nexts = getNextSteps(flow, step.id);
    for (let i = nexts.length - 1; i >= 0; i--) {
      if (!visited.has(nexts[i].id)) stack.push(nexts[i]);
    }
  }
}

export function getFlowParticipants(flow: Flow): {
  componentIds: Set<string>;
  connectionIds: Set<string>;
} {
  const componentIds = new Set<string>();
  const connectionIds = new Set<string>();

  walkFlow(flow, (step) => {
    if (step.componentId) componentIds.add(step.componentId);
    if (step.connectionId) connectionIds.add(step.connectionId);
  });

  return { componentIds, connectionIds };
}

export interface BrokenStep {
  stepId: string;
  reason: "component_deleted" | "connection_deleted";
  missingId: string;
  label: string;
  /**
   * The scene that still holds the missing element, when one does.
   *
   * A scene keeps what it created in its own diff, so from anywhere else in
   * the diagram that element is absent from the view and from the base alike
   * — the same shape a genuinely deleted one has. The step cannot play from
   * here, but it is not garbage: removing it would throw away a reference that
   * works again the moment the scene is opened.
   */
  inScene?: { id: string; name: string };
}

/**
 * The scene that owns `id`, if any scene does.
 *
 * Only a scene's *own* elements count. An element a scene merely hides is
 * still in the base, so it never reaches here.
 */
function sceneHolding(
  scenes: Record<string, SceneDiff> | undefined,
  id: string,
  kind: "component" | "connection",
): { id: string; name: string } | undefined {
  for (const scene of Object.values(scenes ?? {})) {
    const own = kind === "component" ? scene.addedComponents : scene.addedConnections;
    if (own[id]) return { id: scene.id, name: scene.name };
  }
  return undefined;
}

function brokenStep(
  stepId: string,
  reason: BrokenStep["reason"],
  missingId: string,
  inScene: { id: string; name: string } | undefined,
): BrokenStep {
  const what = reason === "component_deleted" ? "component" : "connection";
  const where = inScene ? `lives in scene “${inScene.name}”` : "removed";
  return {
    stepId,
    reason,
    missingId,
    label: `Step ${stepId.slice(0, 8)}… — ${what} ${where} (${missingId.slice(0, 8)}…)`,
    inScene,
  };
}

/**
 * The steps of `flow` whose element is gone from the model.
 *
 * Gone from the model, not merely out of sight: a scene *hides* base elements
 * instead of deleting them, so a component a scene has taken out of view is
 * still in `diagram.snapshot` and the step that names it still means what it
 * said. Reading only the scene's resolved view called those steps broken and
 * refused to play a flow that had nothing wrong with it. An id is missing only
 * when neither the view nor the base has it — which still covers a component
 * created inside a scene and then deleted, since the base never held it.
 *
 * Missing from *here* is not the same as gone, though: an element another
 * scene owns looks identical from outside that scene. Those steps are still
 * reported — the flow cannot play them from this view — but each carries the
 * scene that holds it, so a repair can tell the two apart instead of deleting
 * both.
 */
export function validateFlowGraph(flow: Flow, diagram: Diagram): BrokenStep[] {
  const broken: BrokenStep[] = [];
  const { components, connections } = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
  const base = diagram.snapshot;
  const scenes = diagram.scenes;

  walkFlow(flow, (step) => {
    if (step.componentId && !components[step.componentId] && !base.components[step.componentId]) {
      const id = step.componentId;
      broken.push(
        brokenStep(step.id, "component_deleted", id, sceneHolding(scenes, id, "component")),
      );
    }
    if (
      step.connectionId &&
      !connections[step.connectionId] &&
      !base.connections[step.connectionId]
    ) {
      const id = step.connectionId;
      broken.push(
        brokenStep(step.id, "connection_deleted", id, sceneHolding(scenes, id, "connection")),
      );
    }
  });

  return broken;
}

export function getOrderedStepIds(flow: Flow): string[] {
  const ids: string[] = [];
  walkFlow(flow, (step) => ids.push(step.id));
  return ids;
}

export function getStepCount(flow: Flow): number {
  let count = 0;
  walkFlow(flow, () => count++);
  return count;
}
