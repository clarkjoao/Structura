import type { Node } from "@xyflow/react";
import type { Component } from "@/features/diagram";
import {
  isAwsComponent,
  isAzureComponent,
  isC4Component,
  isGcpComponent,
  isNoteComponent,
  isPanelComponent,
} from "@/features/diagram";

/** Neutral swatch for group shapes, plugin types and anything without a palette entry. */
const NEUTRAL = "hsl(var(--muted-foreground))";
const SURFACE = "hsl(var(--border))";

/**
 * The minimap needs a resolved CSS color, while the canvas palette lives in Tailwind class
 * names. Both read the same custom properties, so the swatch follows the active theme.
 */
function colorForComponent(component: Component): string {
  if (isC4Component(component)) {
    return `hsl(var(--node-${component.type}))`;
  }
  if (isAwsComponent(component) || isGcpComponent(component) || isAzureComponent(component)) {
    // Cloud component types are already the category id ("aws-compute", "gcp-storage", …),
    // which is exactly how the color tokens are named.
    return `hsl(var(--${component.type}))`;
  }
  if (isPanelComponent(component) || isNoteComponent(component)) {
    return SURFACE;
  }
  return NEUTRAL;
}

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
    return component ? colorForComponent(component) : NEUTRAL;
  };
}
