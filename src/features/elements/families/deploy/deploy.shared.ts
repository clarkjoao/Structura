import type { CSSProperties } from "react";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import { flowPlaybackOpacity } from "@/features/canvas/flow/flowState";
import { laneAccentFor } from "@/features/canvas/nodes/laneAccent";
import { MAX_HANDLES, MIN_HANDLES } from "@/features/diagram/model/layout.constants";
import type { Component, SkinParts } from "@/features/diagram/model/component.types";

/**
 * The deployment family: sharded stores (and, in later slices, Kubernetes,
 * Step Functions). Its elements are typed containers and their children,
 * drawn with the flow skin and the C4 card's handles.
 */
export const DEPLOY_FAMILY_ID = "deploy";
export const DEPLOY_CATEGORY_ID = "deploy";

/** Blue, the database token — what a data store is painted in by default. */
export const DEPLOY_STORE_ACCENT = "hsl(var(--gcp-database))";

export const skinPatchableKeys = ["customColor", "fill", "stroke"] as const;

function clampSlots(count: number): number {
  return Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
}

/** What every deployment node receives: identity, skin, handles, selection. */
export function deployBuildData(comp: Component & SkinParts, ctx: NodeBuildContext) {
  const counts = ctx.connectionCounts[comp.id] ?? { incoming: 0, outgoing: 0 };
  return {
    elementId: comp.id,
    name: comp.name,
    description: comp.description,
    customColor: comp.customColor,
    fill: comp.fill,
    stroke: comp.stroke,
    laneAccent: laneAccentFor(comp, ctx),
    incomingCount: clampSlots(counts.incoming),
    outgoingCount: clampSlots(counts.outgoing),
    isSelected: ctx.isPlaying
      ? ctx.flowHighlight.activeNodeId === comp.id
      : ctx.selectedNodeId === comp.id,
  };
}

/** The flow's dimming while a script is read — the one rule every card uses. */
export function playbackStyle(comp: Component, ctx: NodeBuildContext): CSSProperties {
  return ctx.isPlaying ? { opacity: flowPlaybackOpacity(comp.id, ctx.flowHighlight) } : {};
}
