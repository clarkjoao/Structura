import type {
  Component,
  Connection,
  Diagram,
  EdgeLayout,
  Folder,
  ModelDraft,
  UserTemplate,
  ViewNodeLayout,
} from "../model/diagram.types";
import type { ServiceDefinition } from "../model/service.types";
import type { AppActions } from "./actions.types";

export interface DiagramSnapshot {
  diagramId: string;
  snapshot: ModelDraft;
  nodeLayouts: Record<string, ViewNodeLayout>;
  edgeLayouts: Record<string, EdgeLayout>;
  timestamp: number;
}

export interface ClipboardEntry {
  components: Component[];
  connections: Connection[];

  relativeOffsets?: Array<{ dx: number; dy: number }>;
}

export interface AppState {
  diagrams: Record<string, Diagram>;
  folders: Record<string, Folder>;
  userTemplates: Record<string, UserTemplate>;
  serviceCatalog: Record<string, ServiceDefinition>;
  activeDiagramId: string | null;
  past: DiagramSnapshot[];
  future: DiagramSnapshot[];
  _lastUndoRedoAt: number;
  clipboard: ClipboardEntry | null;
}

export type DiagramStore = AppState & AppActions;
