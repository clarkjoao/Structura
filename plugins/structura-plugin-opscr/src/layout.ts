import type { PluginLayout } from "./types/plugin.types";
import type { ViewBox, ViewLayoutGraph, ViewLayoutResult } from "./generated/opscr-mapping";

/**
 * The layout engine is the host's (`api.layout`, API 1.19): the plugin bundles none. `activate`
 * hands it over before anything can project a workspace; tests install the host engine through
 * `test/host-layout.setup.ts`.
 */
let engine: PluginLayout | undefined;

/** Installs the engine; returns the one it replaces. */
export function setHostLayout(layout: PluginLayout): PluginLayout | undefined {
  const previous = engine;
  engine = layout;
  return previous;
}

/**
 * Lays out the view's graph with the host's engine and returns each node's box relative to its
 * parent. Edge routes are not returned: the canvas routes connections itself.
 *
 * `seed` — boxes from a previous layout, by node id — is handed over as the nodes' positions, so
 * the engine keeps the drawn order; feed the result to `stabilizeLayout` to keep surviving nodes
 * exactly in place.
 */
export async function layoutView(
  graph: ViewLayoutGraph,
  seed?: ReadonlyMap<string, ViewBox>,
): Promise<ViewLayoutResult> {
  if (!engine) throw new Error("[opscr] the host's layout engine is not set: activate first");
  const { boxes } = await engine.arrange({
    nodes: graph.nodes.map((node) => {
      const at = seed?.get(node.id);
      return at ? { ...node, position: { x: at.x, y: at.y } } : node;
    }),
    edges: graph.edges,
  });
  return { boxes: new Map(Object.entries(boxes)), edgeRoutes: new Map() };
}
