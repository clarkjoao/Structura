import type { CSSProperties, ComponentType as ReactComponentType } from "react";
import type {
  CompareElementVisual,
  Component,
  ComponentType,
  Diagram,
  FlowStep,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../../flow/flowState";

export type { FlowHighlight, RecordingInfo, CoverageInfo };

export interface NodeBuildContext {
  diagram: Diagram;
  /** Merged base + active scene (same as canvas visibility). */
  resolvedComponents: Record<string, Component>;
  resolvedNodeLayouts: Record<string, NodeLayout>;
  /** Scene-only elements in the active scene → badge { name, color }. */
  sceneBadgeByComponentId: Record<string, { name: string; color: string }>;
  /** Compare mode: per-node opacity + badge metadata (scene A = active). */
  compareVisualByComponentId?: Record<string, CompareElementVisual>;
  isCompareMode?: boolean;
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  dragTargetPanelId: string | null;
  /** When a child is dragged outside this panel's bounds, show unparent warning. */
  unparentCandidatePanelId: string | null;
  panelIds: Set<string>;
  connectionCounts: Record<string, { incoming: number; outgoing: number }>;
  /** Effective handle→connection mapping after applying handleOrder (or round-robin fallback). */
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;
  /** Callback to reorder a handle up or down on the canvas node. */
  onReorderHandle?: (nodeId: string, side: "incoming" | "outgoing", connId: string, direction: "up" | "down") => void;
  isPlaying: boolean;
  isRecording: boolean;
  flowHighlight: FlowHighlight;
  activeStep: FlowStep | null;
  recordingInfo: RecordingInfo | null;
  coverage: CoverageInfo | null;
  handleDrillDown: (id: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onPanelCollapseToggle?: (panelId: string) => void;
  /** When playing a flow from an endpoint handler, the id of the flow currently playing. */
  activeFlowId?: string | null;
  /** Start playback of a flow (e.g. from endpoint handler click). */
  onPlayFlow?: (flowId: string) => void;
  /** Add a new endpoint child to an api-group. */
  onAddEndpointToGroup?: (groupId: string) => void;
}

export interface NodeTypeDescriptor {
  /** ReactFlow node type key (e.g. "c4", "panel", "note") */
  rfType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ReactComponentType<any>;
  /** Return true for every ComponentType this descriptor handles */
  matches: (type: ComponentType) => boolean;
  zIndex: number | ((comp: Component) => number);
  connectable: boolean;
  /** Can this node nest inside a panel? */
  canHaveParent: boolean;
  /** Can this node act as a parent for other nodes? */
  canBeParent: boolean;
  /** Build the ReactFlow `data` prop */
  buildData: (comp: Component, ctx: NodeBuildContext) => Record<string, unknown>;
  /** Build optional `style` overrides */
  buildStyle?: (comp: Component, ctx: NodeBuildContext) => CSSProperties | undefined;
  /** Default node dimensions used when no layout size is stored. */
  defaultSize?: { width: number; height: number };
  /** Default extra data fields merged into buildData output for this type. */
  defaultData?: Partial<Record<string, unknown>>;
  /** ReactFlow node draggable (default true). */
  draggable?: boolean;
  /** ReactFlow node selectable (default true). */
  selectable?: boolean;
  /** ReactFlow node focusable (default true). */
  focusable?: boolean;
}