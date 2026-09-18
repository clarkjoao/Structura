import type { Component, Connection, NodeLayout } from "../model/diagram.types";

/**
 * What is on the canvas at all: a component is placed when it has a layout,
 * and a connection when both of its ends are placed.
 *
 * One rule for every surface. The editor's store selectors
 * (`useVisibleComponents` / `useVisibleConnections`) and the viewer's
 * projection (`resolveViewSnapshot`) both read it from here, so a component
 * with no layout can never be drawn by one and skipped by the other again
 * (docs/investigation/divergencia-edicao-visualizacao.md §3.3).
 *
 * Insertion order is kept; render order is decided later, on placed
 * components only.
 */
export function placedComponents(
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
): Component[] {
  const placedIds = new Set(Object.keys(nodeLayouts));
  return Object.values(components).filter((component) => placedIds.has(component.id));
}

export function placedConnections(
  connections: Record<string, Connection>,
  nodeLayouts: Record<string, NodeLayout>,
): Connection[] {
  const placedIds = new Set(Object.keys(nodeLayouts));
  return Object.values(connections).filter(
    (connection) => placedIds.has(connection.sourceId) && placedIds.has(connection.targetId),
  );
}
