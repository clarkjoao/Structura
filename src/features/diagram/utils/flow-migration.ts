import type { Flow, FlowStep } from "../model/flow.types";
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
  payloadDirection?: 'request' | 'response';
}

/**
 * Converts a flow from the old array-based format to the new graph-based format.
 * If the flow already uses Record<string, FlowStep>, returns it as-is.
 */
export function migrateFlow(raw: unknown): Flow {
  const flow = raw as Flow & { steps: unknown };

  if (!Array.isArray(flow.steps)) {
    // Already in the new format
    return flow as Flow;
  }

  const legacySteps = flow.steps as LegacyFlowStep[];
  const newSteps: Record<string, FlowStep> = {};
  const stepIds: string[] = [];

  // Create steps with generated ids
  for (const legacy of legacySteps) {
    const id = generateId("step");
    stepIds.push(id);
    newSteps[id] = {
      id,
      type: 'action',
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

  // Link sequentially
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
