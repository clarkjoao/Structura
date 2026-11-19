import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "@/features/plugins/plugin.types";

/**
 * The editable embed's `postMessage` protocol — a remote plugin API: the host changes the diagram
 * with the plugin `applyChanges` shape and hears every committed change as a plugin snapshot.
 *
 *   embed → host   STRUCTURA_EDITOR_READY                                listening
 *   embed → host   STRUCTURA_EDITOR_SNAPSHOT { diagram }                 the diagram changed
 *   embed → host   STRUCTURA_EDITOR_APPLIED { requestId, result, diagram }  answer to an APPLY
 *   host  → embed  STRUCTURA_EDITOR_APPLY { requestId, changes }         change the diagram
 *   host  → embed  STRUCTURA_THEME { theme }                             follow the host's theme
 *
 * Snapshots follow canvas edits, undo/redo and applied changes alike, debounced like the plugin
 * `onDiagramChange`, so a host binding the diagram to files treats them all the same way. An
 * APPLIED answer carries the diagram as it is right after the change, so the host never works
 * from a snapshot older than its own change.
 */
export const EDITOR_READY = "STRUCTURA_EDITOR_READY";
export const EDITOR_SNAPSHOT = "STRUCTURA_EDITOR_SNAPSHOT";
export const EDITOR_APPLIED = "STRUCTURA_EDITOR_APPLIED";
export const EDITOR_APPLY = "STRUCTURA_EDITOR_APPLY";
export const THEME = "STRUCTURA_THEME";

export type EditorHostMessage =
  | { type: typeof EDITOR_APPLY; requestId: number; changes: PluginDiagramChanges }
  | { type: typeof THEME; theme: "light" | "dark" };

export type EditorEmbedMessage =
  | { type: typeof EDITOR_READY }
  | { type: typeof EDITOR_SNAPSHOT; diagram: DiagramSnapshot }
  | {
      type: typeof EDITOR_APPLIED;
      requestId: number;
      result: PluginDiagramChangesResult;
      diagram: DiagramSnapshot | null;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A message from the host, when it is one of ours and well-formed; null otherwise. */
export function readHostMessage(data: unknown): EditorHostMessage | null {
  if (!isRecord(data)) return null;
  if (data["type"] === THEME) {
    return data["theme"] === "dark" || data["theme"] === "light"
      ? { type: THEME, theme: data["theme"] }
      : null;
  }
  if (data["type"] === EDITOR_APPLY) {
    const { requestId, changes } = data;
    if (typeof requestId !== "number" || !isRecord(changes)) return null;
    // The plugin API sanitizes every field; only the envelope is checked here.
    return { type: EDITOR_APPLY, requestId, changes: changes as PluginDiagramChanges };
  }
  return null;
}
