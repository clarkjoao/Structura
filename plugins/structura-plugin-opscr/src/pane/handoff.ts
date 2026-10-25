import type { PluginFolder } from "../types/plugin.types";

/**
 * Folders a workspace import picked for a diagram it made: the pane opens the folder at once,
 * in the same session, instead of asking for it again (Reconnect).
 */
const handed = new Map<string, PluginFolder>();

export function handOff(diagramId: string, folder: PluginFolder): void {
  handed.set(diagramId, folder);
}

/** The folder handed to the pane for this diagram, once. */
export function takeHandedOff(diagramId: string): PluginFolder | undefined {
  const folder = handed.get(diagramId);
  handed.delete(diagramId);
  return folder;
}
