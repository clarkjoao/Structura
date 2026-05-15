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
  SceneDiff,
  NodeLayout,
  IconDefinition,
  Point,
  UserTemplate,
  ExternalLink,
} from "../model/diagram.types";
import type { ServiceDefinition } from "../model/service.types";
import type { EdgeStyle } from "../model/connection.types";

export interface AppActions {
  addDiagram: (
    name: string,
    level: Level,
    domain?: string,
    folderId?: string | null,
    description?: string,
  ) => Diagram;
  addImportedDiagram: (diagram: Diagram) => Diagram;
  importDiagram: (diagram: Diagram) => Diagram;
  duplicateDiagram: (sourceId: string, name: string) => Diagram | null;
  openDiagram: (id: string) => void;
  updateDiagram: (id: string, patch: Partial<Pick<Diagram, "name" | "domain">>) => void;
  updateDiagramDescription: (diagramId: string, description: string) => void;
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
    flowShape?: import("../model/diagram.types").FlowNodeShape,
  ) => Component;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  updateHandleOrder: (componentId: string, side: "incoming" | "outgoing", orderedConnectionIds: string[]) => void;

  addExternalLink: (componentId: string, link: Omit<ExternalLink, "id">) => void;
  updateExternalLink: (componentId: string, linkId: string, patch: Partial<Omit<ExternalLink, "id">>) => void;
  removeExternalLink: (componentId: string, linkId: string) => void;

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
  updateEdgeWaypoints: (diagramId: string, connectionId: string, waypoints: Point[]) => void;
  clearEdgeWaypoints: (diagramId: string, connectionId: string) => void;
  updateEdgeLabelOffset: (diagramId: string, connectionId: string, offset: number) => void;

  bringToFront: (elementId: string) => void;
  sendToBack: (elementId: string) => void;
  fitGroupToChildren: (panelId: string) => void;
  applyAutoLayout: (layouts: Array<{ elementId: string; x: number; y: number }>) => void;

  addService: (service: Omit<ServiceDefinition, "id">) => ServiceDefinition;
  updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => void;
  removeService: (id: string) => void;
  linkComponentToService: (componentId: string, serviceId: string | undefined) => void;
  linkComponentToDiagram: (componentId: string, diagramId: string | undefined) => void;
  setParent: (childId: string, parentId: string | null) => void;
  commitNodeDrag: (nodeId: string, newParentId: string | null, newPosition: { x: number; y: number }) => void;
  batchCommitNodeDrag: (entries: Array<{ nodeId: string; newParentId: string | null; newPosition: { x: number; y: number } }>) => void;
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
    template:
      | import("@/lib/catalogs/patterns").PatternTemplate
      | import("../model/diagram.types").UserTemplate,
    position: { x: number; y: number },
  ) => string[];

  undo: () => void;
  redo: () => void;

  copyToClipboard: (componentIds: string[]) => void;
  pasteFromClipboard: (
    position?: { x: number; y: number },
    options?: { preserveParentWhenMissing?: boolean },
  ) => string[];
  importDrawioResult: (
    components: Component[],
    connections: Connection[],
    layouts: NodeLayout[],
  ) => string[];
  importMermaidSequenceResult: (
    components: Component[],
    connections: Connection[],
    steps: Record<string, FlowStep>,
    entryStepId: string,
    flowName: string,
    layouts: NodeLayout[],
  ) => string;
  clearClipboard: () => void;

  addScene: (name: string) => SceneDiff;
  duplicateScene: (sceneId: string, name?: string) => SceneDiff | null;
  removeScene: (sceneId: string) => void;
  mergeSceneIntoBase: (sceneId: string) => void;
  setActiveScene: (sceneId: string | null) => void;
  setCompareScene: (sceneId: string | null) => void;
  renameScene: (sceneId: string, name: string) => void;
  addComponentToScene: (sceneId: string, component: Component, layout: NodeLayout) => void;
  removeComponentFromScene: (sceneId: string, componentId: string) => void;
  addConnectionToScene: (sceneId: string, connection: Connection) => void;
  removeConnectionFromScene: (sceneId: string, connectionId: string) => void;
  updateSceneNodeLayout: (
    sceneId: string,
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;

  addIcon: (diagramId: string, icon: IconDefinition) => void;
  removeIcon: (diagramId: string, iconId: string) => void;
  updateIconName: (diagramId: string, iconId: string, name: string) => void;
  incrementIconUsage: (diagramId: string, iconId: string) => void;
  decrementIconUsage: (diagramId: string, iconId: string) => void;

  saveUserTemplate: (template: UserTemplate) => void;
  updateUserTemplate: (
    id: string,
    patch: Partial<Pick<UserTemplate, "name" | "description" | "category">>,
  ) => void;
  deleteUserTemplate: (id: string) => void;
}
