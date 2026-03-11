import type {
  Component,
  Connection,
  Diagram,
  Folder,
  ModelDraft,
  ViewNodeLayout,
} from "../model/diagram.types";
import type { ServiceDefinition } from "@/features/registry";

export interface DiagramSnapshot {
  diagramId: string;
  snapshot: ModelDraft;
  nodeLayouts: ViewNodeLayout[];
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

export function activeDiagram(state: AppState): Diagram {
  return state.diagrams[state.activeDiagramId!];
}
