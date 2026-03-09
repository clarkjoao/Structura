import type { CSSProperties, ComponentType as ReactComponentType } from "react";
import type { Component, ComponentType, Diagram, FlowStep } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/registry";

export interface FlowHighlight {
  activeNodeId: string | null;
  activeConnId: string | null;
  visitedNodeIds: Set<string>;
  participantNodeIds: Set<string>;
  participantConnIds: Set<string>;
}

export interface RecordingInfo {
  nodeSteps: Map<string, number[]>;
  edgeSteps: Map<string, number[]>;
  recordedNodeIds: Set<string>;
  recordedEdgeIds: Set<string>;
  lastNodeId: string | null;
  lastEdgeId: string | null;
  lastHandleId: string | null;
}

export interface CoverageInfo {
  nodeFlows: Map<string, string[]>;
  edgeFlows: Map<string, string[]>;
}

export interface NodeBuildContext {
  diagram: Diagram;
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  selectedNodeId: string | null;
  dragTargetPanelId: string | null;
  /** When a child is dragged outside this panel's bounds, show unparent warning. */
  unparentCandidatePanelId: string | null;
  panelIds: Set<string>;
  connectionCounts: Record<string, { incoming: number; outgoing: number }>;
  isPlaying: boolean;
  isRecording: boolean;
  flowHighlight: FlowHighlight;
  activeStep: FlowStep | null;
  recordingInfo: RecordingInfo | null;
  coverage: CoverageInfo | null;
  handleDrillDown: (id: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onPanelCollapseToggle?: (panelId: string) => void;
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
}