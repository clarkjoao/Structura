import type { AwsCategoryId } from "@/lib/aws-catalog";
import type { ServiceDefinition } from "@/features/registry";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | "panel"
  | "note"
  | AwsCategoryId;

export type Level = "context" | "container" | "component";

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  parentId: string | null;
  tags?: string[];
  awsService?: string;
  serviceId?: string;
  linkedDiagramId?: string;
  width?: number;
  height?: number;
  panelColor?: string;
  panelOpacity?: number;
}

export type EdgeStyle = "straight" | "bezier" | "step" | "smoothstep";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type EdgeMarker = "arrow" | "arrowclosed" | "none";

export type ConnectionIntent =
  | "dependency"
  | "call"
  | "event"
  | "data-flow"
  | "async-message";

export type ConnectionDirection =
  | "unidirectional"
  | "bidirectional"
  | "reverse";

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  technology?: string;
  description?: string;
  intent?: ConnectionIntent;
  direction?: ConnectionDirection;
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  markerEnd?: EdgeMarker;
  markerStart?: EdgeMarker;
  animated?: boolean;
  /** When "custom", Estilo da Aresta is shown; when "standard" or unset, intent drives style. Default "standard". */
  communicationType?: "standard" | "custom";
  /** Preset for sync/async/event/tcp/udp (Tipo de comunicação dropdown). */
  transportPreset?: "sync" | "async" | "event" | "tcp" | "udp";
}

export interface ViewNodeLayout {
  elementId: string;
  x: number;
  y: number;
  zIndex?: number;
}

export interface FlowStep {
  order: number;
  componentId?: string;
  connectionId?: string;
  note?: string;
  description?: string;
  handleId?: string;
  duration?: string;
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

export interface ModelDraft {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  serviceRegistry: Record<string, ServiceDefinition>;
  flows: Record<string, Flow>;
}

export interface Diagram {
  id: string;
  name: string;
  level: Level;
  domain?: string;
  updatedAt: string;
  snapshot: ModelDraft;
  nodeLayouts: ViewNodeLayout[];
  viewport: { x: number; y: number; zoom: number };
}
