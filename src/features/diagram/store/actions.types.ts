import type {
  Component,
  ComponentPatch,
  Connection,
  Diagram,
  Flow,
  FlowStep,
  FlowBranch,
  ComponentType,
  Level,
  Folder,
  PanelKind,
} from "../model/diagram.types";
import type { ServiceDefinition } from "../model/service.types";
import type { EdgeStyle } from "../model/connection.types";

export interface AppActions {
  addDiagram: (name: string, level: Level, domain?: string, folderId?: string | null) => Diagram;
  openDiagram: (id: string) => void;
  updateDiagram: (id: string, patch: Partial<Pick<Diagram, "name" | "domain">>) => void;
  deleteDiagram: (id: string) => void;
  addFolder: (name: string, parentId: string | null, domain?: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveDiagram: (diagramId: string, folderId: string | null) => void;

  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
    panelKind?: PanelKind,
  ) => Component;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  updateHandleOrder: (componentId: string, side: "incoming" | "outgoing", orderedConnectionIds: string[]) => void;

  addConnection: (
    sourceId: string,
    targetId: string,
    label: string,
    edgeStyle?: EdgeStyle,
  ) => Connection;
  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  removeConnection: (id: string) => void;

  updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  bringToFront: (elementId: string) => void;
  sendToBack: (elementId: string) => void;

  addService: (service: Omit<ServiceDefinition, "id">) => ServiceDefinition;
  updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => void;
  removeService: (id: string) => void;
  linkComponentToService: (componentId: string, serviceId: string | undefined) => void;
  linkComponentToDiagram: (componentId: string, diagramId: string | undefined) => void;
  setParent: (childId: string, parentId: string | null) => void;
  groupNodes: (componentIds: string[]) => string | null;
  ungroupNodes: (panelId: string) => void;

  addFlow: (diagramId: string, name: string, mermaid: string, steps?: Record<string, FlowStep>) => Flow;
  updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => void;
  removeFlow: (id: string) => void;

  addFlowStep: (flowId: string, step: Omit<FlowStep, 'id'>) => string;
  updateFlowStep: (flowId: string, stepId: string, patch: Partial<FlowStep>) => void;
  removeFlowStep: (flowId: string, stepId: string) => void;
  addFlowBranch: (flowId: string, conditionStepId: string, branch: FlowBranch) => void;
  removeFlowBranch: (flowId: string, conditionStepId: string, branchIndex: number) => void;
  convertStepToCondition: (flowId: string, stepId: string, conditionLabel: string, branchLabels: string[]) => void;

  insertPattern: (
    template: import("@/lib/catalogs/patterns").PatternTemplate,
    position: { x: number; y: number },
  ) => void;

  undo: () => void;
  redo: () => void;

  copyToClipboard: (componentIds: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => void;
  clearClipboard: () => void;
}
