export interface JourneyStep {
  id: string;
  label: string;
  description?: string;
  duration?: string;
  order: number;
  diagramId?: string;
  componentId?: string;
  flowId?: string;
  svgContent?: string;
}

export interface Journey {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  tags: string[];
  steps: Record<string, JourneyStep>;
  createdAt: number;
  updatedAt: number;
}
