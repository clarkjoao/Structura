import type { Flow } from "../model/flow.types";

export function buildFlowDuplicatePatch(
  flow: Flow,
  newName: string,
): Omit<Flow, "id" | "diagramId"> {
  return {
    name: newName,
    mermaid: flow.mermaid,
    steps: flow.steps,
    ...(flow.description != null && { description: flow.description }),
    ...(flow.tags?.length && { tags: flow.tags }),
    ...(flow.entryStepId != null && { entryStepId: flow.entryStepId }),
  };
}
