import type {
  Component,
  Connection,
  Diagram,
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
  serviceRegistry: Record<string, ServiceDefinition>;
  activeDiagramId: string | null;
  past: DiagramSnapshot[];
  future: DiagramSnapshot[];
  _lastUndoRedoAt: number;
  clipboard: ClipboardEntry | null;
}

export type DiagramStore = AppState & AppActions;
