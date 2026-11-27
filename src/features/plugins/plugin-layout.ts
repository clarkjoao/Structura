import type { LayoutEdge, LayoutGraph, LayoutNode } from "@/features/canvas/layout/contract";
import { edgeLabelBox } from "@/features/canvas/layout/edgeLabelBox";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type {
  PluginLayout,
  PluginLayoutBox,
  PluginLayoutGraph,
  PluginLayoutResult,
} from "./plugin.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const text = (value: unknown): value is string => typeof value === "string" && value !== "";

/**
 * The plugin's graph as the engine's contract, keeping only what is well formed: plugin data
 * is untrusted, and ELK throws on a node without a size or an edge with an unknown end.
 */
export function toLayoutGraph(graph: PluginLayoutGraph): LayoutGraph {
  const nodes: LayoutNode[] = [];
  const seen = new Set<string>();
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    if (!isRecord(node) || !text(node.id) || seen.has(node.id)) continue;
    if (!finite(node.width) || !finite(node.height) || node.width < 0 || node.height < 0) continue;
    seen.add(node.id);
    const position = node.position;
    nodes.push({
      id: node.id,
      parentId: text(node.parentId) ? node.parentId : null,
      width: node.width,
      height: node.height,
      ...(isRecord(position) &&
        finite(position.x) &&
        finite(position.y) && { position: { x: position.x, y: position.y } }),
    });
  }
  const edges = (Array.isArray(graph?.edges) ? graph.edges : []).flatMap((edge): LayoutEdge[] => {
    if (!isRecord(edge) || !text(edge.id) || !text(edge.sourceId) || !text(edge.targetId)) {
      return [];
    }
    if (!seen.has(edge.sourceId) || !seen.has(edge.targetId)) return [];
    // The label's room is the canvas's sizing (`edgeLabelBox`), never the plugin's: the same
    // text takes the same room on every channel.
    const labelBox = edgeLabelBox(
      typeof edge.label === "string" ? edge.label : undefined,
      typeof edge.technology === "string" ? edge.technology : undefined,
    );
    return [
      {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        ...(labelBox && { labelBox }),
      },
    ];
  });
  return { nodes, edges };
}

/**
 * `api.layout` (v1.19; edge labels v1.20): the canvas's engine, `layoutKeepingOrder`, for a plugin's own graph.
 * The engine is imported on first use, so ELK stays out of the boot chunk this module loads in.
 */
export const pluginLayout: PluginLayout = {
  async arrange(graph: PluginLayoutGraph): Promise<PluginLayoutResult> {
    const input = toLayoutGraph(graph);
    if (input.nodes.length === 0) return { boxes: {} };
    const { layoutKeepingOrder } = await import("@/features/canvas/layout/layoutEngine");
    const result = await layoutKeepingOrder(input);
    const boxes: Record<string, PluginLayoutBox> = {};
    for (const [id, box] of result.boxes) {
      boxes[id] = { x: box.x, y: box.y, width: box.width, height: box.height };
    }
    return { boxes };
  },

  // v1.21: the canvas's placement, for the diagram the plugin names (its direction and settings).
  async place(input) {
    const diagram =
      typeof input?.diagramId === "string"
        ? useDiagramStore.getState().diagrams[input.diagramId]
        : undefined;
    const { placeGraph } = await import("./plugin-place");
    const boxes = await placeGraph({
      graph: input?.graph ?? { components: [], connections: [] },
      ...(input?.previous && { previous: input.previous }),
      ...(diagram?.direction && { direction: diagram.direction }),
      ...(diagram?.layoutSettings && { settings: diagram.layoutSettings }),
    });
    return { boxes };
  },
};
