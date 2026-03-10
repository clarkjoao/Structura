/** All core domain types (Component, Connection, Flow, Diagram, etc.) */
export type {
  ComponentType,
  Level,
  Component,
  C4Component,
  PanelComponent,
  NoteComponent,
  AwsComponent,
  Connection,
  ConnectionStyle,
  ConnectionIntent,
  ConnectionDirection,
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  NodeLayout,
  ViewNodeLayout,
  FlowStep,
  Flow,
  ModelDraft,
  Folder,
  Diagram,
} from "./model/diagram.types";

/** Default styles and helpers for connection intent/direction resolution */
export {
  INTENT_DEFAULTS,
  DIRECTION_MARKERS,
  getEffectiveConnectionStyle,
} from "./model/connection-defaults";

/** Unique ID generator for diagram entities */
export { generateId } from "./model/diagram.utils";

/** Compute which components are impacted when a service changes */
export { computeServiceImpact } from "./model/diagram.service";
export type { ServiceImpact } from "./model/diagram.service";

/** Convert FlowStep[] ↔ Mermaid sequence diagram text */
export { stepsToMermaid, parseMermaidToSteps } from "./model/flow.service";

/** Type guards for the Component discriminated union */
export {
  isPanelComponent,
  isNoteComponent,
  isC4Component,
  isAwsComponent,
} from "./model/component.guards";

/** Zustand store — single source of truth for all diagram state */
export {
  useDiagramStore,
  /** Factory used in tests to create a store backed by a custom storage adapter */
  createDiagramStore,
  /** Selector: all diagrams keyed by id */
  useDiagrams,
  /** Selector: flat array of all diagrams */
  useAllDiagrams,
  /** Selector: all folders keyed by id */
  useFolders,
  /** Selector: flat array of all folders */
  useAllFolders,
  /** Selector: currently active diagram id */
  useActiveDiagramId,
  /** Selector: currently active Diagram object */
  useActiveDiagram,
  /** Selector: components record of the active diagram */
  useComponents,
  /** Selector: single component by id */
  useComponent,
  /** Selector: connections record of the active diagram */
  useConnections,
  /** Selector: components that have a nodeLayout (visible on canvas) */
  useVisibleComponents,
  /** Selector: connections whose both endpoints are visible */
  useVisibleConnections,
  /** Selector: whether an element can be drilled into */
  useCanNavigateInto,
  /** Selector: serviceRegistry of the active diagram */
  useServiceRegistry,
  /** Selector: flat array of all services in the active diagram */
  useAllServices,
  /** Selector: flat array of all components in the active diagram */
  useAllComponents,
  /** Selector: flat array of all connections in the active diagram */
  useAllConnections,
  /** Selector: flat array of all flows in the active diagram */
  useFlows,
  /** Selector: flat array of ALL components across ALL diagrams, each annotated with diagramId + diagramName */
  useAllComponentsAcrossDiagrams,
  /** Hook returning all mutation actions (add/update/remove/undo/redo/…) */
  useDiagramActions,
} from "./store/diagram.store";

export type { DiagramStore, ClipboardEntry } from "./store/diagram.store";
