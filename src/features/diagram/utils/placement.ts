import type { Component, Connection, NodeLayout } from "../model/diagram.types";
import { isTextType } from "../model/component-type-constants";

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
 * Free text is placed only while the diagram's text layer is on
 * (`Diagram.textsVisible`); with it off the texts are in the model but not on
 * any surface. Absent means off, so a caller that forgets the option hides them.
 *
 * Insertion order is kept; render order is decided later, on placed
 * components only.
 */
export function placedComponents(
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
  options: { textsVisible?: boolean } = {},
): Component[] {
  const placedIds = new Set(Object.keys(nodeLayouts));
  return Object.values(components).filter(
    (component) =>
      placedIds.has(component.id) && (options.textsVisible === true || !isTextType(component.type)),
  );
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
