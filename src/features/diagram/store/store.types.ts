import type {
  Component,
  Connection,
  Diagram,
  EdgeLayout,
  Folder,
  ModelDraft,
  SceneDiff,
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
  /**
   * The scenes as they stood at the checkpoint.
   *
   * A scene holds elements of its own, and deleting one of those now sews the
   * base flows: undoing that has to put the element back as well as the step,
   * or the step comes back pointing at nothing. Undefined on a diagram that
   * has no scenes.
   */
  scenes?: Record<string, SceneDiff>;
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
  /**
   * An open flow-editing session. While one is open the flow actions push no
   * checkpoints of their own: the session's is the undo unit. `undoMark` is
   * the length `past` had right after that checkpoint, so an abandoned
   * session can find it again.
   */
  _flowSession: { undoMark: number | null } | null;
  /**
   * The last batch of flow joins made by removing diagram elements, so the
   * canvas can name a change the user did not ask for directly. Consumed and
   * cleared by whoever shows it.
   */
  _flowSewNotices: { id: number; notices: import("../utils/flow-repair").FlowSewNotice[] } | null;
  clipboard: ClipboardEntry | null;
}

export type DiagramStore = AppState & AppActions;
