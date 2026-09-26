import type { CSSProperties } from "react";
import type { Component } from "@/features/diagram/model/component.types";
import {
  isAwsComponent,
  isAzureComponent,
  isC4Component,
  isGcpComponent,
} from "@/features/diagram/model/component.guards";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import { MAX_HANDLES, MIN_HANDLES } from "@/features/diagram/model/layout.constants";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import { versionBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { flowPlaybackOpacity } from "@/features/canvas/flow/flowState";
import { laneAccentFor } from "@/features/canvas/nodes/laneAccent";

import { CARD_RECORDING_DIM_OPACITY } from "./constants";

/**
 * Shared card `buildData` for C4 and every cloud family.
 *
 * Extracted from the C4 catch-all so a registered cloud category can paint
 * through the same CardNode contract without going back through the
 * catch-all descriptor.
 */
export function buildCardNodeData(comp: Component, ctx: NodeBuildContext): Record<string, unknown> {
  const {
    isPlaying,
    isRecording,
    flowHighlight,
    activeStep,
    flowBadges,
    coverage,
    connectionCounts,
  } = ctx;

  const refDiagramId =
    comp.type === "external-element" ? comp.referenceDiagramId : comp.linkedDiagramId;
  const linkedDiagramName = refDiagramId ? ctx.allDiagrams[refDiagramId]?.name : undefined;

  const counts = connectionCounts[comp.id] ?? { incoming: 0, outgoing: 0 };

  return {
    elementId: comp.id,
    name: comp.name,
    type: comp.type,
    description: comp.description,
    technology:
      isC4Component(comp) || isAwsComponent(comp) || isGcpComponent(comp) || isAzureComponent(comp)
        ? comp.technology
        : undefined,
    // Own colour first; else the accent of a swimlane that passes one on
    // (resolved here, never written — see `laneAccentFor`).
    customColor:
      (comp as { customColor?: string }).customColor ??
      (isC4Component(comp) ? comp.panelColor : undefined) ??
      laneAccentFor(comp, ctx),
    cloudService: resolveCloudServiceId(comp),
    isSelected: isPlaying ? flowHighlight.activeNodeId === comp.id : ctx.selectedNodeId === comp.id,
    controlsDisabled:
      !isPlaying &&
      !isRecording &&
      ctx.selectedNodeIds.size > 0 &&
      !ctx.selectedNodeIds.has(comp.id),
    serviceId: comp.serviceId,
    serviceName: comp.serviceId ? ctx.services[comp.serviceId]?.name : undefined,
    externalLinks: comp.externalLinks,
    linkedDiagramName: isPlaying || isRecording ? undefined : linkedDiagramName,
    // A reader names the linked diagram but cannot go there.
    onDrillDown:
      isPlaying || isRecording || ctx.isReader || !linkedDiagramName
        ? undefined
        : ctx.handleDrillDown,
    stepBadges: flowBadges?.nodeLabels.get(comp.id),
    isLastRecorded: flowBadges?.lastNodeId === comp.id,
    coverageFlowNames: coverage?.nodeFlows.get(comp.id),
    isRecording: !!isRecording,
    onHandleClick: isRecording ? ctx.onRecordHandleClick : undefined,
    lastRecordedHandleId:
      isRecording && flowBadges?.lastNodeId === comp.id
        ? (flowBadges?.lastHandleId ?? undefined)
        : undefined,
    activeHandleId:
      isPlaying && flowHighlight.activeNodeId === comp.id
        ? (activeStep?.handleId ?? undefined)
        : undefined,
    incomingCount: Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, counts.incoming)),
    outgoingCount: Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, counts.outgoing)),
    handleOrder: ctx.effectiveHandleOrder[comp.id],
    onReorderHandle:
      isRecording || isPlaying
        ? undefined
        : ctx.onReorderHandle
          ? (side: "incoming" | "outgoing", connId: string, direction: "up" | "down") =>
              ctx.onReorderHandle!(comp.id, side, connId, direction)
          : undefined,
    laidOutMinHeight: laidOutMinHeight(comp, ctx),
    ...versionBadgePropsForNode(ctx, comp.id),
  };
}

/**
 * The height auto-layout measured this card at, as a floor it cannot fall below.
 *
 * A card is content-sized, and its content is not only its own: the service
 * chip and the "explore inside" row need names from the workspace. The reader
 * gets them through `ReaderCatalog`, but a link written before the catalog
 * travelled has none, and a flow being played hides the row on both surfaces —
 * so the same card can come out ~70px shorter. Auto-layout anchors every waypoint at
 * `(slot + 1) / (count + 1)` of the height ELK was given, so a card that draws
 * shorter puts every handle where the corridor does not reach — edges arrive
 * diagonally and the arrowheads turn away from the node.
 *
 * `minHeight`, not `height`: the box is at least what the layout assumed, and a
 * card whose content outgrows a stale entry still expands instead of clipping.
 * Notes and swimlanes already pin their size like this, through `buildStyle` on
 * React Flow's wrapper — which is why they measure identically on both surfaces
 * and cards did not. This one goes on the card element rather than the wrapper
 * because the handles are positioned against the card: a floor on the wrapper
 * alone stretches the box and leaves the handles bunched at the old height.
 *
 * Compare mode is excluded: it redraws both revisions of a card, and pinning
 * either to the other's laid-out height would misreport the diff.
 *
 * The editor applies it only while a flow plays, the one time its own card
 * hides content. Otherwise the editor is where the box comes from: React Flow
 * measures the card and writes the height back, so a floor there is fed by its
 * own measurement and can only rise — a card that grew once (a long
 * description while selected) never shrank back.
 */
function laidOutMinHeight(comp: Component, ctx: NodeBuildContext): number | undefined {
  if (ctx.isCompareMode) return undefined;
  if (!ctx.isReader && !ctx.isPlaying) return undefined;
  const height = ctx.resolvedNodeLayouts?.[comp.id]?.height;
  return typeof height === "number" ? height : undefined;
}

/** Playback / recording opacity for card nodes (C4 + cloud). */
export function buildCardNodeStyle(
  comp: Component,
  ctx: NodeBuildContext,
): CSSProperties | undefined {
  if (ctx.isCompareMode) return undefined;
  if (ctx.isPlaying) {
    return { opacity: flowPlaybackOpacity(comp.id, ctx.flowHighlight), filter: "none" };
  }
  if (ctx.isRecording) {
    return {
      opacity: ctx.flowBadges?.badgedNodeIds.has(comp.id) ? 1 : CARD_RECORDING_DIM_OPACITY,
    };
  }
  return undefined;
}
