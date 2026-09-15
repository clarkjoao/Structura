import type { Component, Connection, Diagram, NodeLayout } from "@/features/diagram";
import {
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  NOTE_DEFAULT_H,
  NOTE_DEFAULT_W,
  PANEL_DEFAULT_H,
  PANEL_DEFAULT_W,
  API_GROUP_ENDPOINT_H,
  API_GROUP_FRAME_W,
} from "@/features/diagram/model/layout.constants";
import { computeApiGroupSize } from "@/features/diagram/utils/api-group-size";
import { fromDiagram, layout, resizableIds, toAppliedLayouts } from "@/features/canvas/layout";

/**
 * Same core path as `useAutoLayout` / the canvas toolbar button:
 * `fromDiagram` → `layout(graph)` (interactive profile) → `toAppliedLayouts`.
 *
 * No DOM measurements (seeds run offline), so sizes are normalised to the same
 * defaults `fromDiagram` would use when the store has no measured boxes — then
 * ELK resizes panels to fit their children, exactly as the button does.
 */
export async function applySeedAutoLayout(diagram: Diagram): Promise<Diagram> {
  const components = diagram.snapshot.components;
  const connections = Object.values(diagram.snapshot.connections) as Connection[];
  const nodeLayouts = sizeHintsForOfflineLayout(components, diagram.nodeLayouts);

  const graph = fromDiagram(components, connections, nodeLayouts);
  if (graph.nodes.length === 0) return diagram;

  // Default profile is "interactive" — same call as useAutoLayout (`layout(graph)`).
  const result = await layout(graph);
  if (result.boxes.size === 0) return diagram;

  const applied = toAppliedLayouts(graph, result, resizableIds(graph, components));
  // Start from the sizes ELK actually laid out (defaults), not the hand-tuned
  // seed coords — otherwise leaf boxes keep 260×110 while ELK placed 180×80.
  return mergeApplied({ ...diagram, nodeLayouts }, applied, result.handleOrder);
}

/**
 * Strip hand-tuned seed sizes so ELK sees the same defaults the toolbar gets
 * when React Flow has not measured yet (or measured close to defaults).
 * Content-driven types keep enough height to stay readable.
 */
function sizeHintsForOfflineLayout(
  components: Record<string, Component>,
  previous: Record<string, NodeLayout>,
): Record<string, NodeLayout> {
  const next: Record<string, NodeLayout> = {};
  const endpointCountByGroup = new Map<string, number>();

  for (const component of Object.values(components)) {
    if (component.type === "endpoint" && component.parentId) {
      endpointCountByGroup.set(
        component.parentId,
        (endpointCountByGroup.get(component.parentId) ?? 0) + 1,
      );
    }
  }

  for (const component of Object.values(components)) {
    const prev = previous[component.id];
    const size = offlineSizeOf(component, endpointCountByGroup.get(component.id) ?? 0);
    next[component.id] = {
      elementId: component.id,
      x: prev?.x ?? 0,
      y: prev?.y ?? 0,
      width: size.width,
      height: size.height,
    };
  }

  return next;
}

function offlineSizeOf(
  component: Component,
  endpointCount: number,
): { width: number; height: number } {
  switch (component.type) {
    case "panel":
      return { width: PANEL_DEFAULT_W, height: PANEL_DEFAULT_H };
    case "note":
      return { width: NOTE_DEFAULT_W, height: NOTE_DEFAULT_H };
    case "db-table": {
      const columns = "columns" in component ? component.columns : [];
      const height = 32 + 22 + 20 + 2 + columns.length * 24;
      return { width: 406, height };
    }
    case "json-viewer":
      return { width: 280, height: 180 };
    case "api-group":
      return computeApiGroupSize(endpointCount);
    case "endpoint":
      // Relative box inside the parent api-group (ApiGroupNode owns final packing).
      return { width: API_GROUP_FRAME_W - 24, height: API_GROUP_ENDPOINT_H };
    case "svg":
      return { width: 160, height: 160 };
    default:
      return { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H };
  }
}

function mergeApplied(
  diagram: Diagram,
  applied: ReturnType<typeof toAppliedLayouts>,
  handleOrder: {
    outgoing: Map<string, string[]>;
    incoming: Map<string, string[]>;
  },
): Diagram {
  const nodeLayouts: Record<string, NodeLayout> = { ...diagram.nodeLayouts };
  for (const entry of applied) {
    const previous = diagram.nodeLayouts[entry.elementId];
    nodeLayouts[entry.elementId] = {
      ...previous,
      elementId: entry.elementId,
      x: entry.x,
      y: entry.y,
      ...(entry.width !== undefined ? { width: entry.width } : {}),
      ...(entry.height !== undefined ? { height: entry.height } : {}),
    };
  }

  const orderedComponents: Record<string, Component> = {};
  for (const [id, component] of Object.entries(diagram.snapshot.components)) {
    const outgoing = handleOrder.outgoing.get(id);
    const incoming = handleOrder.incoming.get(id);
    if (!outgoing?.length && !incoming?.length) {
      orderedComponents[id] = component;
      continue;
    }
    orderedComponents[id] = {
      ...component,
      handleOrder: {
        outgoing: outgoing ?? component.handleOrder?.outgoing ?? [],
        incoming: incoming ?? component.handleOrder?.incoming ?? [],
      },
    };
  }

  const bounds = Object.values(nodeLayouts).reduce(
    (acc, box) => ({
      maxX: Math.max(acc.maxX, box.x + (box.width ?? DEFAULT_NODE_W)),
      maxY: Math.max(acc.maxY, box.y + (box.height ?? DEFAULT_NODE_H)),
    }),
    { maxX: 0, maxY: 0 },
  );

  // Approximate fitView({ padding: 0.2 }) without React Flow.
  const zoom = Math.min(1, 1200 / Math.max(bounds.maxX, 1), 800 / Math.max(bounds.maxY, 1));
  const viewport = {
    x: 40,
    y: 20,
    zoom: Math.max(0.35, Math.min(0.9, zoom * 0.8)),
  };

  return {
    ...diagram,
    snapshot: { ...diagram.snapshot, components: orderedComponents },
    nodeLayouts,
    viewport,
  };
}
