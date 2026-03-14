import type { AwsCategoryId } from "@/lib/aws-catalog";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | "panel"
  | "note"
  | AwsCategoryId;

export type Level = "context" | "container" | "component" | string;

// ── Component discriminated union ─────────────────────────────────────────

interface BaseComponent {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  tags?: string[];
  serviceId?: string;
  linkedDiagramId?: string;
  /** When true, node is hidden on canvas (e.g. child of collapsed panel). Never clear parentId. */
  hidden?: boolean;
  /** Explicit ordering of connections by handle position. Incoming = left side, outgoing = right side. */
  handleOrder?: {
    incoming: string[]; // connection ids, left side
    outgoing: string[]; // connection ids, right side
  };
}

export interface C4Component extends BaseComponent {
  type: "person" | "system" | "container" | "component";
  technology?: string;
  /** Cor customizada (borda e ícone). Quando definida, sobrescreve a cor padrão do tipo. */
  panelColor?: string;
}

export type PanelKind =
  | "default"
  | "availability-zone"
  | "eks-cluster"
  | "ecs-cluster"
  | "auto-scaling-group"
  | "vpc"
  | "public-subnet"
  | "private-subnet";

export interface PanelComponent extends BaseComponent {
  type: "panel";
  /** Kind of infrastructure panel (AZ, EKS, VPC, subnet, etc.). Default: "default". */
  panelKind?: PanelKind;
  panelColor?: string;
  panelOpacity?: number;
  /** When true, panel renders minimized (compact). */
  collapsed?: boolean;
  /** Internal: saved panel width before collapse; restored on expand. */
  collapsedWidth?: number;
  /** Internal: saved panel height before collapse; restored on expand. */
  collapsedHeight?: number;
}

export interface NoteComponent extends BaseComponent {
  type: "note";
  panelColor?: string;
}

export interface AwsComponent extends BaseComponent {
  type: AwsCategoryId;
  awsService?: string;
  technology?: string;
}

export type Component = C4Component | PanelComponent | NoteComponent | AwsComponent;

/** Patch for updateComponent: allows any property from any component variant, plus width/height (applied to NodeLayout). */
export type ComponentPatch = Partial<Omit<C4Component, "id">> &
  Partial<Omit<PanelComponent, "id">> &
  Partial<Omit<NoteComponent, "id">> &
  Partial<Omit<AwsComponent, "id">> & { width?: number; height?: number };

// ── Edge / Connection types ───────────────────────────────────────────────

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

export interface ConnectionStyle {
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  markerEnd?: EdgeMarker;
  markerStart?: EdgeMarker;
  animated?: boolean;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  technology?: string;
  description?: string;
  intent?: ConnectionIntent;
  direction?: ConnectionDirection;
  /** When "custom", Estilo da Aresta is shown; when "standard" or unset, intent drives style. */
  communicationType?: "standard" | "custom";
  /** Preset for sync/async/event/tcp/udp (Tipo de comunicação dropdown). */
  transportPreset?: "sync" | "async" | "event" | "tcp" | "udp";
  /** Explicit visual style overrides. When absent, style is derived from intent + direction. */
  style?: ConnectionStyle;
}

// ── Layout ────────────────────────────────────────────────────────────────

export interface NodeLayout {
  elementId: string;
  x: number;
  y: number;
  zIndex?: number;
  width?: number;
  height?: number;
}

// ── Flow ──────────────────────────────────────────────────────────────────

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
  flows: Record<string, Flow>;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  domain?: string;
}

export interface Diagram {
  id: string;
  name: string;
  level: Level;
  domain?: string;
  updatedAt: string;
  snapshot: ModelDraft;
  nodeLayouts: NodeLayout[];
  viewport: { x: number; y: number; zoom: number };
  folderId?: string | null;
}
