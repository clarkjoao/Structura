import type { Flow, FlowStep } from "../model/flow.types";
import { parseConditionKind } from "./flow-condition-kind";
import { generateId } from "./generate-id";

interface LegacyFlowStep {
  order: number;
  componentId?: string;
  connectionId?: string;
  note?: string;
  description?: string;
  handleId?: string;
  duration?: string;
  payload?: string;
  payloadDirection?: "request" | "response";
}

/**
 * Moves a branch point's keyword out of the label it was hiding in.
 *
 * The Mermaid importer used to write `alt` / `par` / `loop` into
 * `conditionLabel`, so the only record of what a block *was* sat in the field
 * meant for the author's question, and every reader had to sniff it back out.
 * The keyword now has a field, and a label that is nothing but a keyword was
 * never a question — so it moves rather than being kept in both places.
 *
 * Idempotent, like every migration here: a step that already carries a kind is
 * left exactly as it is, whatever its label says.
 */
function promoteConditionKinds(steps: Record<string, FlowStep>): void {
  for (const step of Object.values(steps ?? {})) {
    if (!step || step.conditionKind !== undefined) continue;
    const kind = parseConditionKind(step.conditionLabel);
    if (!kind) continue;
    step.conditionKind = kind;
    delete step.conditionLabel;
  }
}

export function migrateFlow(raw: unknown): Flow {
  const flow = raw as Flow & { steps: unknown };

  if (!Array.isArray(flow.steps)) {
    promoteConditionKinds((flow as Flow).steps);
    return flow as Flow;
  }

  const legacySteps = flow.steps as LegacyFlowStep[];
  const newSteps: Record<string, FlowStep> = {};
  const stepIds: string[] = [];

  for (const legacy of legacySteps) {
    const id = generateId("step");
    stepIds.push(id);
    newSteps[id] = {
      id,
      type: "action",
      componentId: legacy.componentId,
      connectionId: legacy.connectionId,
      note: legacy.note,
      description: legacy.description,
      handleId: legacy.handleId,
      duration: legacy.duration,
      payload: legacy.payload,
      payloadDirection: legacy.payloadDirection,
    };
  }

  for (let i = 0; i < stepIds.length - 1; i++) {
    newSteps[stepIds[i]].next = stepIds[i + 1];
  }

  return {
    id: flow.id,
    name: flow.name,
    mermaid: flow.mermaid,
    diagramId: flow.diagramId,
    description: flow.description,
    tags: flow.tags,
    entryStepId: stepIds[0],
    steps: newSteps,
  };
}
