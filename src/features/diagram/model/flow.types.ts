import type { ConnectionIntent } from "./connection.types";

export type FlowStepType = "action" | "condition" | "note";

export interface FlowBranch {
  label: string;
  nextId: string;
}

export interface FlowStep {
  id: string;
  type: FlowStepType;

  next?: string;
  branches?: FlowBranch[];

  /**
   * A short heading the author writes for this step, shown while reading.
   *
   * Optional, like `note`: a script recorded before either existed carries
   * neither, and reading it shows exactly what it showed before. Together they
   * are what turns stepping through a flow into reading one — without them a
   * step says only which component it points at.
   */
  title?: string;
  componentId?: string;
  connectionId?: string;
  description?: string;
  note?: string;
  handleId?: string;
  duration?: string;
  payload?: string;
  payloadDirection?: "request" | "response";
  isAsync?: boolean;
  connectionIntent?: ConnectionIntent;

  conditionLabel?: string;
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
