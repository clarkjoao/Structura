import type { Flow, Diagram } from "@/features/diagram";
import { resolveSceneSnapshot } from "@/features/diagram";

export interface BrokenStep {
  stepIndex: number;
  stepOrder: number;
  reason: "component_deleted" | "connection_deleted";
  missingId: string;
  label: string;
}

export function validateFlow(flow: Flow, diagram: Diagram): BrokenStep[] {
  const broken: BrokenStep[] = [];
  const { components, connections } = resolveSceneSnapshot(
    diagram,
    diagram.activeSceneId ?? null,
  );

  flow.steps.forEach((step, i) => {
    if (step.componentId && !components[step.componentId]) {
      broken.push({
        stepIndex: i,
        stepOrder: step.order,
        reason: "component_deleted",
        missingId: step.componentId,
        label: `Step ${i + 1} — componente removido (${step.componentId.slice(0, 8)}…)`,
      });
    }
    if (step.connectionId && !connections[step.connectionId]) {
      broken.push({
        stepIndex: i,
        stepOrder: step.order,
        reason: "connection_deleted",
        missingId: step.connectionId,
        label: `Step ${i + 1} — conexão removida (${step.connectionId.slice(0, 8)}…)`,
      });
    }
  });

  return broken;
}
