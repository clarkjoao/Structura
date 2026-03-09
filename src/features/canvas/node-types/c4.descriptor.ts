import type { CSSProperties } from "react";
import CustomNode from "../nodes/CustomNode";
import type { NodeTypeDescriptor, NodeBuildContext } from "./types";
import type { Component } from "@/features/diagram";

function buildC4Style(
  comp: Component,
  ctx: NodeBuildContext,
): CSSProperties | undefined {
  if (ctx.isPlaying) {
    const { activeNodeId, visitedNodeIds, participantNodeIds } = ctx.flowHighlight;
    if (activeNodeId === comp.id) return { opacity: 1, filter: "none" };
    if (visitedNodeIds.has(comp.id)) return { opacity: 0.85, filter: "none" };
    if (participantNodeIds.has(comp.id)) return { opacity: 0.5, filter: "none" };
    return { opacity: 0.25, filter: "none" };
  }
  if (ctx.isRecording) {
    return {
      opacity: ctx.recordingInfo?.recordedNodeIds.has(comp.id) ? 1 : 0.35,
    };
  }
  return undefined;
}

export const c4Descriptor: NodeTypeDescriptor = {
  rfType: "c4",
  component: CustomNode,
  // Catch-all: handles person, system, container, component, and all AWS types
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

    return {
      elementId: comp.id,
      name: comp.name,
      type: comp.type,
      description: comp.description,
      technology: comp.technology,
      awsService: comp.awsService,
      isSelected: isPlaying
        ? flowHighlight.activeNodeId === comp.id
        : ctx.selectedNodeId === comp.id,
      serviceName: comp.serviceId
        ? ctx.serviceRegistry[comp.serviceId]?.name
        : undefined,
      linkedDiagramName: isPlaying || isRecording ? undefined : linkedDiagramName,
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
    };
  },

  buildStyle: buildC4Style,
};