import type { CSSProperties } from "react";
import type { NodeTypes } from "@xyflow/react";
import type {
  CompareElementVisual,
  Component,
  ComponentPatch,
  ComponentType,
  Diagram,
  DiagramModel,
  Flow,
  FlowStep,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../../flow/flowState";

export type { FlowHighlight, RecordingInfo, CoverageInfo };

export interface NodeBuildContext {
  diagram: Diagram | DiagramModel;

  flows: Flow[];

  resolvedComponents: Record<string, Component>;
  resolvedNodeLayouts: Record<string, NodeLayout>;

  sceneBadgeByComponentId: Record<string, { name: string; color: string }>;

  compareVisualByComponentId?: Record<string, CompareElementVisual>;
  isCompareMode?: boolean;
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  dragTargetPanelId: string | null;

  unparentCandidatePanelId: string | null;
  panelIds: Set<string>;
  connectionCounts: Record<string, { incoming: number; outgoing: number }>;

  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;

  onReorderHandle?: (
    nodeId: string,
    side: "incoming" | "outgoing",
    connId: string,
    direction: "up" | "down",
  ) => void;
  isPlaying: boolean;
  isRecording: boolean;
  flowHighlight: FlowHighlight;
  activeStep: FlowStep | null;
  recordingInfo: RecordingInfo | null;
  coverage: CoverageInfo | null;
  handleDrillDown: (id: string) => void;
  navigateToDiagram?: (diagramId: string, nodeId?: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onPanelCollapseToggle?: (panelId: string) => void;

  activeFlowId?: string | null;

  onPlayFlow?: (flowId: string) => void;

  onAddEndpointToGroup?: (groupId: string) => void;

  setNoteInlineEditingId?: (id: string | null) => void;

  setJsonViewerInlineEditingId?: (id: string | null) => void;

  updateComponent?: (id: string, patch: ComponentPatch) => void;

  journeysByComponentId?: Record<string, { name: string }[]>;

  childrenIndex: Map<string, Set<string>>;
}

export interface NodeTypeDescriptor {
  rfType: string;

  /** React component rendered for this node; uses React Flow's own NodeTypes value contract. */
  component: NodeTypes[string];

  matches: (type: ComponentType) => boolean;
  zIndex: number | ((comp: Component) => number);
  connectable: boolean;

  canHaveParent: boolean;

  canBeParent: boolean;

  buildData: (comp: Component, ctx: NodeBuildContext) => Record<string, unknown>;

  buildStyle?: (comp: Component, ctx: NodeBuildContext) => CSSProperties | undefined;

  defaultSize?: { width: number; height: number };

  defaultData?: Partial<Record<string, unknown>>;

  draggable?: boolean;

  selectable?: boolean;

  focusable?: boolean;

  dragHandle?: string;
}
