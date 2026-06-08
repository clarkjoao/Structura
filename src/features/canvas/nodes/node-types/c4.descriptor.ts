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

export function buildC4Style(
  comp: Component,
  ctx: NodeBuildContext,
): CSSProperties | undefined {
  if (ctx.isCompareMode) return undefined;
  if (ctx.isPlaying) {
    const { activeNodeId, visitedNodeIds, participantNodeIds } =
      ctx.flowHighlight;
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

    const linkedDiagramName = comp.linkedDiagramId
      ? ctx.allDiagrams[comp.linkedDiagramId]?.name
      : undefined;

    const counts = connectionCounts[comp.id] ?? { incoming: 0, outgoing: 0 };

    const journeyData = ctx.journeysByComponentId?.[comp.id];

    return {
      elementId: comp.id,
      name: comp.name,
      type: comp.type,
      description: comp.description,
      technology: isC4Component(comp) ? comp.technology : undefined,
      customColor: isC4Component(comp) && comp.panelColor ? comp.panelColor : undefined,
      awsService: isAwsComponent(comp) ? comp.awsService
                : isGcpComponent(comp) ? comp.gcpService
                : isAzureComponent(comp) ? comp.azureService
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
      serviceName: comp.serviceId
        ? ctx.serviceRegistry[comp.serviceId]?.name
        : undefined,
      externalLinks: comp.externalLinks,
      linkedDiagramName:
        isPlaying || isRecording ? undefined : linkedDiagramName,
      onDrillDown:
        isPlaying || isRecording
          ? undefined
          : linkedDiagramName
            ? ctx.handleDrillDown
            : undefined,
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
      incomingCount: Math.min(4, Math.max(1, counts.incoming)),
      outgoingCount: Math.min(4, Math.max(1, counts.outgoing)),
      handleOrder: ctx.effectiveHandleOrder[comp.id],
      onReorderHandle:
        isRecording || isPlaying
          ? undefined
          : ctx.onReorderHandle
            ? (
                side: "incoming" | "outgoing",
                connId: string,
                direction: "up" | "down",
              ) => ctx.onReorderHandle!(comp.id, side, connId, direction)
            : undefined,
      journeyCount: journeyData?.length ?? 0,
      journeyNames: journeyData?.map((journeyEntry) => journeyEntry.name) ?? [],
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: buildC4Style,
};
