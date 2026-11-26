import type { Component } from "@/features/diagram";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { resolveElementCanvas } from "@/features/elements/element.registry";
import CardNode from "./CardNode";
import NoteNode from "./NoteNode";
import PanelNode from "./PanelNode";

/** The node renderers that draw a component's custom icon (`useResolvedComponentIcon`). */
const RENDERERS_WITH_CUSTOM_ICON: ReadonlySet<unknown> = new Set([CardNode, PanelNode, NoteNode]);

/**
 * Whether a custom icon can be picked for this component: its renderer draws one.
 *
 * Decided by what draws the component, never by whether `customIconId` happens to be on the
 * object — a component created without the key had no way to get an icon from the toolbar.
 * A reference draws the link glyph, never an icon of its own.
 */
export function supportsCustomIcon(component: Component): boolean {
  if (isSharedRefComponent(component)) return false;
  const canvas = resolveElementCanvas(component);
  return canvas !== undefined && RENDERERS_WITH_CUSTOM_ICON.has(canvas.component);
}
