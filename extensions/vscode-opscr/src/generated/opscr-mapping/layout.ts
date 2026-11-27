/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of plugins/structura-plugin-opscr/src/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the plugin's files and re-sync instead of changing this file.
 */

import { toImporterGraph, type ImporterGraph } from "./importer-graph";
import type { TechnicalView, ViewEdge, ViewNode } from "./types";

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewLayoutResult {
  boxes: ReadonlyMap<string, ViewBox>;
  edgeRoutes: ReadonlyMap<string, ReadonlyArray<{ x: number; y: number }>>;
  /**
   * The parent each box is relative to (null: the root), when known. A box under another parent
   * than the view's no longer means anything there: the element is placed again.
   */
  parents?: ReadonlyMap<string, string | null>;
}

/**
 * The host's placement as this library sees it: the shape of the plugin API's
 * `api.layout.place` (v1.21), restated structurally. Structura places — sizes, the Arrange, the
 * automatic mode's "beside what it connects to" — and nothing here does: the plugin reaches it
 * through `api.layout`, the VSCode extension through its webview (the embed's `STRUCTURA_PLACE`).
 */
export interface ViewPlacer {
  place(input: {
    graph: Pick<ImporterGraph, "components" | "connections">;
    previous?: Record<string, ViewBox & { parentKey: string | null }>;
  }): Promise<{ boxes: Record<string, ViewBox> }>;
}

/**
 * The view placed by the host: with no `previous`, arranged as the canvas's Arrange would; with
 * one, every element still under the same parent keeps its box exactly and each new one goes
 * where the canvas's automatic mode would put it. Boxes are relative to the parent.
 */
export async function placeViewWith(
  placer: ViewPlacer,
  view: TechnicalView,
  previous?: ViewLayoutResult,
): Promise<ViewLayoutResult> {
  const parentOf = new Map(view.nodes.map((n) => [n.id, n.parentId]));
  const drawn: Record<string, ViewBox & { parentKey: string | null }> = {};
  for (const [id, box] of previous?.boxes ?? []) {
    if (!parentOf.has(id)) continue;
    const parentKey = previous?.parents?.has(id)
      ? (previous.parents.get(id) ?? null)
      : (parentOf.get(id) ?? null);
    drawn[id] = { ...box, parentKey };
  }
  const graph = toImporterGraph(placeView(view, { boxes: new Map(), edgeRoutes: new Map() }));
  const { boxes } = await placer.place({
    graph,
    ...(Object.keys(drawn).length > 0 && { previous: drawn }),
  });
  return { boxes: new Map(Object.entries(boxes)), edgeRoutes: new Map(), parents: parentOf };
}

export interface PlacedNode extends ViewNode {
  /** Relative to the parent's box; roots relative to the layout origin. */
  box: ViewBox;
}

export interface PlacedEdge extends ViewEdge {
  /** The engine's route, border to border, in absolute coordinates; empty if none. */
  route: Array<{ x: number; y: number }>;
}

export interface PlacedView extends Omit<TechnicalView, "nodes" | "edges"> {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

/**
 * Attach a layout result to the view. A node the result has no box for is at the origin with no
 * size (the host's to give), so a partial result degrades instead of losing nodes.
 */
export function placeView(view: TechnicalView, result: ViewLayoutResult): PlacedView {
  return {
    ...view,
    nodes: view.nodes.map((node) => {
      const box = result.boxes.get(node.id);
      return { ...node, box: box ? { ...box } : { x: 0, y: 0, width: 0, height: 0 } };
    }),
    edges: view.edges.map((edge) => ({
      ...edge,
      route: (result.edgeRoutes.get(edge.id) ?? []).map((p) => ({ x: p.x, y: p.y })),
    })),
  };
}
