import type { Node } from "@xyflow/react";
import type { Component } from "@/features/diagram";
import { componentSwatchColor, COMPONENT_SWATCH_NEUTRAL } from "../nodes/componentColor";

/**
 * Build the `nodeColor` callback for `<MiniMap>`, resolving each node against the domain
 * components rather than the React Flow node data — only the C4 descriptor carries the
 * component type in `node.data`, so reading it there would leave most nodes uncolored.
 */
export function makeMiniMapNodeColor(
  components: Record<string, Component>,
): (node: Node) => string {
  return (node) => {
    const component = components[node.id];
    return component ? componentSwatchColor(component) : COMPONENT_SWATCH_NEUTRAL;
  };
}
