import type { SourceText } from "./patches";

/**
 * The folder the pane has open, as other parts of the plugin (the chat context) see it. Set
 * while a bound folder is connected; null otherwise.
 */
export interface PaneSession {
  diagramId: string;
  /** The manifests, unsaved edits included. */
  manifests(): SourceText[];
  config(): SourceText | undefined;
  /** Puts new manifest texts (and new files) in the pane, unsaved, and syncs the canvas. */
  apply(files: readonly SourceText[]): void;
}

let current: PaneSession | null = null;

export const getSession = () => current;

/** Opens a session; the returned function closes it if it is still the current one. */
export function openSession(session: PaneSession): () => void {
  current = session;
  return () => {
    if (current === session) current = null;
  };
}
