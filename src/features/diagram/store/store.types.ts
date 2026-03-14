import type {
  Component,
  Connection,
  Diagram,
  Folder,
  ModelDraft,
  ViewNodeLayout,
} from "../model/diagram.types";

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  technology: string[];
  owner?: string;
  tags?: string[];
  source?: "defectdojo" | "github" | "manual";
  sourceId?: string;
  metadata?: Record<string, unknown>;
}


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