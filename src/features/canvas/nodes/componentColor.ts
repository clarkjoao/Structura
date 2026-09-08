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
export const COMPONENT_SWATCH_NEUTRAL = "hsl(var(--muted-foreground))";
export const COMPONENT_SWATCH_SURFACE = "hsl(var(--border))";

/**
 * A component's palette entry as a resolved CSS color.
 *
 * The canvas paints a node's category through Tailwind class names, but the
 * minimap and the reading rail need the same color as a value. Both read the
 * same custom properties, so the swatch follows the active theme.
 */
export function componentSwatchColor(component: Component): string {
  if (isC4Component(component)) {
    return `hsl(var(--node-${component.type}))`;
  }
  if (isAwsComponent(component) || isGcpComponent(component) || isAzureComponent(component)) {
    // Cloud component types are already the category id ("aws-compute", "gcp-storage", …),
    // which is exactly how the color tokens are named.
    return `hsl(var(--${component.type}))`;
  }
  if (isPanelComponent(component) || isNoteComponent(component)) {
    return COMPONENT_SWATCH_SURFACE;
  }
  return COMPONENT_SWATCH_NEUTRAL;
}

/**
 * The technology chip's text, when the element carries one.
 *
 * Only the C4 and cloud shapes have the field; everything else — a panel, a
 * note, a plugin type — says nothing rather than guessing.
 */
export function componentTechnology(component: Component): string | undefined {
  if (
    isC4Component(component) ||
    isAwsComponent(component) ||
    isGcpComponent(component) ||
    isAzureComponent(component)
  ) {
    return component.technology?.trim() || undefined;
  }
  return undefined;
}
