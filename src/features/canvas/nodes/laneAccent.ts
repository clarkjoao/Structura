import { PanelKind } from "@/features/diagram/enums";
import type { Component } from "@/features/diagram/model/component.types";
import { isPanelComponent } from "@/features/diagram/model/component.guards";
import type { NodeBuildContext } from "./node-types/types";

const THEME_TOKEN_RE = /^hsl\(\s*var\(--[\w-]+\)\s*\)$/;

/**
 * The accent a node inherits from the swimlane it sits in, or `undefined`.
 *
 * Resolved at render — `node.accent ?? lane.accent ?? family default` — and
 * never written onto the node, so an unedited diagram keeps its checksum.
 *
 * Only a lane accent chosen from the flow presets is passed on, and those are
 * theme tokens. Every lane saved before this has a literal colour — the
 * swimlane was created with `#6366f1` and the toolbar wrote literal HSL — so
 * inheriting any lane colour would have repainted every node in every
 * existing lane. A token can only have come from the new presets.
 */
export function laneAccentFor(comp: Component, ctx: NodeBuildContext): string | undefined {
  return laneAccentOf(comp, comp.parentId ? ctx.resolvedComponents[comp.parentId] : undefined);
}

/** `laneAccentFor` given the parent itself — for the controls, which have no build context. */
export function laneAccentOf(comp: Component, parent: Component | undefined): string | undefined {
  if (!comp.parentId || !parent || parent.id !== comp.parentId) return undefined;
  if (!isPanelComponent(parent) || parent.panelKind !== PanelKind.Swimlane) {
    return undefined;
  }
  const accent = parent.swimlane?.laneColor ?? parent.panelColor;
  return accent && THEME_TOKEN_RE.test(accent.trim()) ? accent : undefined;
}

/**
 * The component as an export should see it: a skinned node (flow, VSM) with no
 * accent of its own gets its lane's accent on a transient copy, so draw.io
 * shows the colour the canvas draws. The stored component is never touched.
 *
 * Only skinned elements: their export reads the accent. A C4 or cloud card
 * inherits on the canvas too, but its draw.io cell uses the C4/cloud palette
 * and exports no custom colour at all, own or inherited.
 */
export function withInheritedAccent<C extends Component>(
  comp: C,
  parent: Component | undefined,
  isSkinned: boolean,
): C {
  if (!isSkinned) return comp;
  const own = comp as { customColor?: string; nodeColor?: string };
  if (own.customColor || own.nodeColor) return comp;
  const lane = laneAccentOf(comp, parent);
  return lane ? { ...comp, customColor: lane } : comp;
}
