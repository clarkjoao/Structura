import type { Component, Diagram, NodeLayout } from "@/features/diagram/model";
import { fromDiagram, resizableIds } from "@/features/canvas/layout/fromDiagram";
import { toAppliedLayouts } from "@/features/canvas/layout/applyLayout";
import { layout } from "@/features/canvas/layout/layoutEngine";

/**
 * Arranges a diagram for reading, and hands back a copy.
 *
 * Pure: the store is never touched and the diagram passed in is never
 * mutated. That is what makes it usable from `/view`, which shows diagrams it
 * does not own — one read from a file on disk has no store entry at all, and
 * one read from the store belongs to the user, who did not ask for their saved
 * positions to be rewritten by opening a link.
 *
 * It is also what makes the re-layout instant. There is no animation to
 * suppress: the canvas is handed a new `Diagram` object with different
 * positions, React Flow re-renders at them, and nothing interpolates. The
 * editor's transition lives in the canvas's own drag path, which the viewer
 * does not mount.
 */
export async function layoutForVisualization(diagram: Diagram): Promise<Diagram> {
  const components = diagram.snapshot.components;
  const connections = Object.values(diagram.snapshot.connections);

  const graph = fromDiagram(components, connections, diagram.nodeLayouts);
  if (graph.nodes.length === 0) return diagram;

  const result = await layout(graph, "visualization");
  const applied = toAppliedLayouts(graph, result, resizableIds(graph, components));

  // Every node the layout placed, plus the ones it was never given (an
  // ApiGroup's endpoints, which the group lays out itself) at the position
  // they already had.
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

  // ELK sorts the edges along each node's border to minimise crossings, and
  // that ordering is thrown away unless it reaches the components: the viewer
  // hands out handles round-robin in connection order otherwise. It is worth
  // roughly a 3x difference in rendered crossings on the reference diagrams.
  const orderedComponents: Record<string, Component> = {};
  for (const [id, component] of Object.entries(components)) {
    const outgoing = result.handleOrder.outgoing.get(id);
    const incoming = result.handleOrder.incoming.get(id);
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

  return {
    ...diagram,
    snapshot: { ...diagram.snapshot, components: orderedComponents },
    nodeLayouts,
  };
}
