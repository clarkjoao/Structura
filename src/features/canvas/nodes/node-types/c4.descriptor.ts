import type { CSSProperties } from "react";
import CustomNode from "../CustomNode";
import type { NodeTypeDescriptor, NodeBuildContext } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import {
  isAwsComponent,
  isGcpComponent,
  isAzureComponent,
  isC4Component,
  type Component,
} from "@/features/diagram";
import { OPACITY_FLOW_PLAYBACK_PARTICIPANT } from "../../canvas.constants";

const C4_FLOW_PLAYBACK_DIM_OPACITY = 0.25;

const C4_RECORDING_DIM_OPACITY = 0.35;

export function buildC4Style(comp: Component, ctx: NodeBuildContext): CSSProperties | undefined {
  if (ctx.isCompareMode) return undefined;
  if (ctx.isPlaying) {
    const { activeNodeId, visitedNodeIds, participantNodeIds } = ctx.flowHighlight;
    if (activeNodeId === comp.id) return { opacity: 1, filter: "none" };
    if (visitedNodeIds.has(comp.id)) return { opacity: 0.85, filter: "none" };
    if (participantNodeIds.has(comp.id))
      return { opacity: OPACITY_FLOW_PLAYBACK_PARTICIPANT, filter: "none" };
    return { opacity: C4_FLOW_PLAYBACK_DIM_OPACITY, filter: "none" };
  }
  if (ctx.isRecording) {
    return {
      opacity: ctx.recordingInfo?.recordedNodeIds.has(comp.id) ? 1 : C4_RECORDING_DIM_OPACITY,
    };
  }
  return undefined;
}

export const c4Descriptor: NodeTypeDescriptor = {
  rfType: "c4",
  component: CustomNode,

  matches: () => true,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,

  buildData: (comp, ctx) => {
    const {
      isPlaying,
      isRecording,
      flowHighlight,
      activeStep,
      recordingInfo,
      coverage,
      connectionCounts,
    } = ctx;

    // c4 descriptor is the catch-all — both drill-down (BaseComponent)
    // and cross-diagram reference (ExternalElementComponent) feed the
    // same "linkedDiagramName" data slot.
    const refDiagramId =
      comp.type === "external-element" ? comp.referenceDiagramId : comp.linkedDiagramId;
    const linkedDiagramName = refDiagramId ? ctx.allDiagrams[refDiagramId]?.name : undefined;

    const counts = connectionCounts[comp.id] ?? { incoming: 0, outgoing: 0 };

    const journeyData = ctx.journeysByComponentId?.[comp.id];

    return {
      elementId: comp.id,
      name: comp.name,
      type: comp.type,
      description: comp.description,
      // Cloud components carry `technology` too ("Fargate", "Aurora PostgreSQL").
      // Passing only C4 here meant an AWS node always fell through to the
      // category name in `CustomNode`, so a technology the user (or the
      // generator) set was never shown. The fallback still applies when the
      // field is empty, which is what keeps existing diagrams unchanged.
      technology:
        isC4Component(comp) ||
        isAwsComponent(comp) ||
        isGcpComponent(comp) ||
        isAzureComponent(comp)
          ? comp.technology
          : undefined,
      customColor:
        (comp as { customColor?: string }).customColor ??
        (isC4Component(comp) ? comp.panelColor : undefined),
      awsService: isAwsComponent(comp)
        ? comp.awsService
        : isGcpComponent(comp)
          ? comp.gcpService
          : isAzureComponent(comp)
            ? comp.azureService
            : undefined,
      isSelected: isPlaying
        ? flowHighlight.activeNodeId === comp.id
        : ctx.selectedNodeId === comp.id,
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
      recordingBadges: recordingInfo?.nodeSteps.get(comp.id),
      isLastRecorded: recordingInfo?.lastNodeId === comp.id,
      coverageFlowNames: coverage?.nodeFlows.get(comp.id),
      isRecording: !!isRecording,
      onHandleClick: isRecording ? ctx.onRecordHandleClick : undefined,
      lastRecordedHandleId:
        isRecording && recordingInfo?.lastNodeId === comp.id
          ? (recordingInfo?.lastHandleId ?? undefined)
          : undefined,
      activeHandleId:
        isPlaying && flowHighlight.activeNodeId === comp.id
          ? (activeStep?.handleId ?? undefined)
          : undefined,
      // Per-side counts when geometry is known; the totals are the fallback.
      incomingCount: Math.min(4, Math.max(1, counts.incomingLeft ?? counts.incoming)),
      outgoingCount: Math.min(4, Math.max(1, counts.outgoingRight ?? counts.outgoing)),
      outgoingLeftCount: Math.min(4, counts.outgoingLeft ?? 0),
      incomingRightCount: Math.min(4, counts.incomingRight ?? 0),
      handleOrder: ctx.effectiveHandleOrder[comp.id],
      onReorderHandle:
        isRecording || isPlaying
          ? undefined
          : ctx.onReorderHandle
            ? (side: "incoming" | "outgoing", connId: string, direction: "up" | "down") =>
                ctx.onReorderHandle!(comp.id, side, connId, direction)
            : undefined,
      journeyCount: journeyData?.length ?? 0,
      journeyNames: journeyData?.map((journeyEntry) => journeyEntry.name) ?? [],
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: buildC4Style,
};
