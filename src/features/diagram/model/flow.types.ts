export type FlowStepType = 'action' | 'condition' | 'note';

export interface FlowBranch {
  label: string;
  nextId: string;
}

export interface FlowStep {
  id: string;
  type: FlowStepType;

  // linking
  next?: string;
  branches?: FlowBranch[];

  // content
  componentId?: string;
  connectionId?: string;
  description?: string;
  note?: string;
  handleId?: string;
  duration?: string;
  payload?: string;
  payloadDirection?: 'request' | 'response';
  isAsync?: boolean;

  // condition-specific
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
