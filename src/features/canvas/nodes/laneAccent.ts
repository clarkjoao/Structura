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
  if (!comp.parentId) return undefined;
  const parent = ctx.resolvedComponents[comp.parentId];
  if (!parent || !isPanelComponent(parent) || parent.panelKind !== PanelKind.Swimlane) {
    return undefined;
  }
  const accent = parent.swimlane?.laneColor ?? parent.panelColor;
  return accent && THEME_TOKEN_RE.test(accent.trim()) ? accent : undefined;
}
