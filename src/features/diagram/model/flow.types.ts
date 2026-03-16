export interface FlowStep {
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

export interface Flow {
  id: string;
  name: string;
  mermaid: string;
  steps: FlowStep[];
  diagramId: string;
  description?: string;
  tags?: string[];
}
