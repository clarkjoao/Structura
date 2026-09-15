import type { CSSProperties } from "react";
import type { Component } from "@/features/diagram/model/component.types";
import {
  isAwsComponent,
  isAzureComponent,
  isC4Component,
  isGcpComponent,
} from "@/features/diagram/model/component.guards";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { flowPlaybackOpacity } from "@/features/canvas/flow/flowState";

const CARD_RECORDING_DIM_OPACITY = 0.35;

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
    customColor:
      (comp as { customColor?: string }).customColor ??
      (isC4Component(comp) ? comp.panelColor : undefined),
    cloudService: resolveCloudServiceId(comp),
    isSelected: isPlaying ? flowHighlight.activeNodeId === comp.id : ctx.selectedNodeId === comp.id,
    controlsDisabled:
      !isPlaying &&
      !isRecording &&
      ctx.selectedNodeIds.size > 0 &&
      !ctx.selectedNodeIds.has(comp.id),
    serviceId: comp.serviceId,
    serviceName: comp.serviceId ? ctx.serviceCatalog[comp.serviceId]?.name : undefined,
    externalLinks: comp.externalLinks,
    linkedDiagramName: isPlaying || isRecording ? undefined : linkedDiagramName,
    onDrillDown:
      isPlaying || isRecording ? undefined : linkedDiagramName ? ctx.handleDrillDown : undefined,
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
    incomingCount: Math.min(4, Math.max(1, counts.incoming)),
    outgoingCount: Math.min(4, Math.max(1, counts.outgoing)),
    handleOrder: ctx.effectiveHandleOrder[comp.id],
    onReorderHandle:
      isRecording || isPlaying
        ? undefined
        : ctx.onReorderHandle
          ? (side: "incoming" | "outgoing", connId: string, direction: "up" | "down") =>
              ctx.onReorderHandle!(comp.id, side, connId, direction)
          : undefined,
    ...sceneBadgePropsForNode(ctx, comp.id),
  };
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
