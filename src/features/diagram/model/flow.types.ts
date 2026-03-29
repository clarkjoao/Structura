export type FlowStepType = "action" | "condition" | "note" | "flow-link";

export interface FlowBranch {
  label: string;
  nextId: string;
}

export type FlowStep =
  | {
      id: string;
      type: "action" | "note";
      next?: string;
      componentId?: string;
      connectionId?: string;
      description?: string;
      note?: string;
      handleId?: string;
      duration?: string;
      payload?: string;
      payloadDirection?: "request" | "response";
      isAsync?: boolean;
    }
  | {
      id: string;
      type: "condition";
      next?: string;
      branches?: FlowBranch[];
      conditionLabel?: string;
      componentId?: string;
      connectionId?: string;
      description?: string;
      note?: string;
      handleId?: string;
      duration?: string;
      payload?: string;
      payloadDirection?: "request" | "response";
      isAsync?: boolean;
    }
  | {
      id: string;
      type: "flow-link";
      targetFlowId: string;
      targetFlowName: string;
      targetDiagramId: string;
      targetDiagramName: string;
      note?: string;
      description?: string;
    };

export type FlowLinkStep = Extract<FlowStep, { type: "flow-link" }>;

/** Target diagram + flow when attaching a flow-link step. */
export interface FlowLinkTarget {
  targetFlowId: string;
  targetFlowName: string;
  targetDiagramId: string;
  targetDiagramName: string;
}

export function isFlowLinkStep(step: FlowStep): step is FlowLinkStep {
  return step.type === "flow-link";
}

export interface Flow {
  id: string;
  name: string;
  mermaid: string;
  diagramId: string;
  description?: string;
  tags?: string[];
  entryStepId?: string;
  steps: Record<string, FlowStep>;
}
