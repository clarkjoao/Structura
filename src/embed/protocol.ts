import {
  normalizeLayoutSettings,
  type DiagramLayoutSettings,
} from "@/features/diagram/model/layout-settings";
import type { ImportResult, PluginPlaceInput } from "@/features/plugins/plugin.types";

/**
 * The embed preview's `postMessage` protocol.
 *
 *   embed → host   STRUCTURA_READY                                listening
 *   embed → host   STRUCTURA_RENDERED { nodes, arranged }          a graph is on screen (arranged here?)
 *   host  → embed  STRUCTURA_LOAD_GRAPH { components, connections, arrange? }  replace the picture
 *   host  → embed  STRUCTURA_ARRANGE { arrange }                    arrange the picture again
 *   host  → embed  STRUCTURA_THEME { theme: "light" | "dark" }      follow the host's theme
 *   host  → embed  STRUCTURA_SEARCH                                  open the element search
 *   host  → embed  STRUCTURA_BLOCKED { reason, errors, problems }    why there is no (new) picture
 *   host  → embed  STRUCTURA_SELECT { element: { kind, key } | null }  light an element, in view
 *   embed → host   STRUCTURA_REVEAL { element: { kind, key } }      the reader clicked an element
 *   embed → host   STRUCTURA_OPEN { element: { kind, key } }        the reader double-clicked an element
 *   embed → host   STRUCTURA_OPEN_PROBLEM { index }                 the reader clicked a BLOCKED problem
 *   host  → embed  STRUCTURA_PROBE                                   say what is on screen
 *   embed → host   STRUCTURA_PROBE_RESULT { viewport, searchOpen, visible, blocked, selected }   …the answer (for tests)
 *   host  → embed  STRUCTURA_PLACE { id, graph, previous?, arrange? }   place a graph as the canvas does
 *   embed → host   STRUCTURA_PLACE_RESULT { id, boxes } | { id, error }   …the boxes, by component key
 *
 * The graph is the plugin importer result (API 1.3), so a host that can write an importer
 * can drive the preview, and both draw the same thing. An element is named by its component
 * `key`, or for a connection by its key from `connectionKeys` (ends, label, occurrence).
 *
 * `arrange` is `{ mode, settings? }`. `"manual"` (the default) draws the host's positions;
 * `"automatic"` arranges every picture in the embed with the canvas arranger, under
 * `settings` (a `DiagramLayoutSettings`: density, gaps, references), so it reads the way the
 * diagram reads on the canvas. An absent or malformed `arrange` on LOAD_GRAPH keeps the current one.
 *
 * `STRUCTURA_PLACE` is `api.layout.place` (plugin API 1.21) over `postMessage`: an importer graph
 * and where its elements are drawn now (`previous`, by key), answered with every element's box by
 * the same implementation the app hands plugins (`features/plugins/plugin-place`), under the
 * `arrange` settings. It is how a host that cannot run the canvas itself — the VSCode extension,
 * in its Node host — places a picture: one engine and one placement, `features/canvas/layout`,
 * for every channel.
 *
 * Messages to the host go to the embedding page (`window.parent`), or — inside a VSCode
 * webview, where the parent is not the extension — through `acquireVsCodeApi()`.
 */
export const READY = "STRUCTURA_READY";
export const RENDERED = "STRUCTURA_RENDERED";
export const LOAD_GRAPH = "STRUCTURA_LOAD_GRAPH";
export const THEME = "STRUCTURA_THEME";
export const SEARCH = "STRUCTURA_SEARCH";
export const BLOCKED = "STRUCTURA_BLOCKED";
export const PROBE = "STRUCTURA_PROBE";
export const PROBE_RESULT = "STRUCTURA_PROBE_RESULT";
export const SELECT = "STRUCTURA_SELECT";
export const REVEAL = "STRUCTURA_REVEAL";
export const OPEN = "STRUCTURA_OPEN";
export const OPEN_PROBLEM = "STRUCTURA_OPEN_PROBLEM";
export const ARRANGE = "STRUCTURA_ARRANGE";
export const PLACE = "STRUCTURA_PLACE";
export const PLACE_RESULT = "STRUCTURA_PLACE_RESULT";

/** Who places the picture: the host (`manual`), or the canvas arranger in the embed (`automatic`). */
export interface PreviewArrange {
  mode: "automatic" | "manual";
  /** Normalised: defaults dropped, values clamped, unknown fields gone; absent is the defaults. */
  settings?: DiagramLayoutSettings;
}

/** A component by its key, or a connection by its `connectionKeys` key. */
export interface PreviewElementRef {
  kind: "component" | "connection";
  key: string;
}

export type PreviewGraph = Pick<ImportResult, "components" | "connections">;

export type EmbedMessage =
  | { type: typeof LOAD_GRAPH; graph: PreviewGraph; arrange?: PreviewArrange }
  | { type: typeof ARRANGE; arrange: PreviewArrange }
  /** `id` is the host's, echoed in the answer; the graph is checked as an import's would be. */
  | {
      type: typeof PLACE;
      id: string | number;
      graph: PluginPlaceInput["graph"];
      previous?: PluginPlaceInput["previous"];
      arrange?: PreviewArrange;
    }
  | { type: typeof THEME; theme: "light" | "dark" }
  | { type: typeof SEARCH }
  | { type: typeof PROBE }
  | { type: typeof SELECT; element: PreviewElementRef | null }
  | {
      type: typeof BLOCKED;
      reason: "parse" | "errors";
      errors: number;
      /** A few of the errors, as one line each ("file:line message"). */
      problems: string[];
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * A posted `arrange`, or undefined when it is not one. The settings go through the same
 * normalisation as a diagram's (`normalizeLayoutSettings`): a host is not trusted with them.
 * The arrangement's own `mode` (`automatic` re-arranging after edits) is the embed's `mode` here,
 * so it is not kept in the settings.
 */
function readArrange(value: unknown): PreviewArrange | undefined {
  if (!isRecord(value)) return undefined;
  if (value["mode"] !== "automatic" && value["mode"] !== "manual") return undefined;
  const raw = value["settings"];
  // Normalisation checks every field it keeps; the cast only lets it read them.
  const normalized = isRecord(raw)
    ? normalizeLayoutSettings(raw as DiagramLayoutSettings)
    : undefined;
  const { mode: _ignored, ...settings } = normalized ?? {};
  return {
    mode: value["mode"],
    ...(Object.keys(settings).length > 0 && { settings }),
  };
}

/** The message, when it is one of ours and well-formed; null otherwise (ignored). */
export function readEmbedMessage(data: unknown): EmbedMessage | null {
  if (!isRecord(data)) return null;
  if (data["type"] === THEME) {
    return data["theme"] === "dark" || data["theme"] === "light"
      ? { type: THEME, theme: data["theme"] }
      : null;
  }
  if (data["type"] === SEARCH) return { type: SEARCH };
  if (data["type"] === PROBE) return { type: PROBE };
  if (data["type"] === SELECT) {
    const element = data["element"];
    if (element === null) return { type: SELECT, element: null };
    if (!isRecord(element) || typeof element["key"] !== "string") return null;
    if (element["kind"] !== "component" && element["kind"] !== "connection") return null;
    return { type: SELECT, element: { kind: element["kind"], key: element["key"] } };
  }
  if (data["type"] === BLOCKED) {
    const reason = data["reason"] === "parse" ? "parse" : "errors";
    const errors = typeof data["errors"] === "number" ? data["errors"] : 0;
    const problems = Array.isArray(data["problems"])
      ? data["problems"].filter((p): p is string => typeof p === "string").slice(0, 5)
      : [];
    return { type: BLOCKED, reason, errors, problems };
  }
  if (data["type"] === ARRANGE) {
    const arrange = readArrange(data["arrange"]);
    return arrange ? { type: ARRANGE, arrange } : null;
  }
  if (data["type"] === PLACE) {
    const id = data["id"];
    const graph = data["graph"];
    const validId = typeof id === "string" || (typeof id === "number" && Number.isFinite(id));
    if (!validId || !isRecord(graph)) return null;
    const { components, connections } = graph;
    if (!Array.isArray(components) || !Array.isArray(connections)) return null;
    const previous = data["previous"];
    const arrange = readArrange(data["arrange"]);
    // As they came: the graph is checked as an import's is (`toGeneratedGraph`), and a previous
    // box only counts when it is finite (`placeGraph`).
    return {
      type: PLACE,
      id,
      graph: {
        components: components as PluginPlaceInput["graph"]["components"],
        connections: connections as PluginPlaceInput["graph"]["connections"],
      },
      ...(isRecord(previous) && { previous: previous as PluginPlaceInput["previous"] }),
      ...(arrange && { arrange }),
    };
  }
  if (data["type"] === LOAD_GRAPH) {
    const { components, connections } = data;
    if (!Array.isArray(components) || !Array.isArray(connections)) return null;
    const arrange = readArrange(data["arrange"]);
    return {
      type: LOAD_GRAPH,
      graph: {
        components: components as PreviewGraph["components"],
        connections: connections as PreviewGraph["connections"],
      },
      ...(arrange && { arrange }),
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
