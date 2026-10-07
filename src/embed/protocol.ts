import type { ImportResult } from "@/features/plugins/plugin.types";

/**
 * The embed preview's `postMessage` protocol.
 *
 *   embed → host   STRUCTURA_READY                                listening
 *   embed → host   STRUCTURA_RENDERED { nodes }                    a graph is on screen
 *   host  → embed  STRUCTURA_LOAD_GRAPH { components, connections }  replace the picture
 *   host  → embed  STRUCTURA_THEME { theme: "light" | "dark" }      follow the host's theme
 *
 * The graph is the plugin importer result (API 1.3), so a host that can write an importer
 * can drive the preview, and both draw the same thing.
 *
 * Messages to the host go to the embedding page (`window.parent`), or — inside a VSCode
 * webview, where the parent is not the extension — through `acquireVsCodeApi()`.
 */
export const READY = "STRUCTURA_READY";
export const RENDERED = "STRUCTURA_RENDERED";
export const LOAD_GRAPH = "STRUCTURA_LOAD_GRAPH";
export const THEME = "STRUCTURA_THEME";

export type PreviewGraph = Pick<ImportResult, "components" | "connections">;

export type EmbedMessage =
  | { type: typeof LOAD_GRAPH; graph: PreviewGraph }
  | { type: typeof THEME; theme: "light" | "dark" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The message, when it is one of ours and well-formed; null otherwise (ignored). */
export function readEmbedMessage(data: unknown): EmbedMessage | null {
  if (!isRecord(data)) return null;
  if (data["type"] === THEME) {
    return data["theme"] === "dark" || data["theme"] === "light"
      ? { type: THEME, theme: data["theme"] }
      : null;
  }
  if (data["type"] === LOAD_GRAPH) {
    const { components, connections } = data;
    if (!Array.isArray(components) || !Array.isArray(connections)) return null;
    return {
      type: LOAD_GRAPH,
      graph: {
        components: components as PreviewGraph["components"],
        connections: connections as PreviewGraph["connections"],
      },
    };
  }
  return null;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare global {
  // Defined by VSCode inside a webview, and callable once per page.
  function acquireVsCodeApi(): VsCodeApi;
}

let vscode: VsCodeApi | null | undefined;

/** Sends a message to whoever hosts the preview. */
export function postToHost(message: { type: string; [field: string]: unknown }): void {
  if (vscode === undefined) {
    vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
  }
  if (vscode) vscode.postMessage(message);
  else window.parent.postMessage(message, "*");
}
