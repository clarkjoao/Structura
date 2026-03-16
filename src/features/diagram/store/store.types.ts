import type {
  Component,
  Connection,
  Diagram,
  Folder,
  ModelDraft,
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
}

export interface AppState {
  diagrams: Record<string, Diagram>;
  folders: Record<string, Folder>;
  serviceRegistry: Record<string, ServiceDefinition>;
  activeDiagramId: string | null;
  past: DiagramSnapshot[];
  future: DiagramSnapshot[];
  _lastUndoRedoAt: number;
  clipboard: ClipboardEntry | null;
}

/** Store completo: estado + ações. */
export type DiagramStore = AppState & AppActions;