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
import { flowPlaybackOpacity } from "../../flow/flowState";

const C4_RECORDING_DIM_OPACITY = 0.35;

export function buildC4Style(comp: Component, ctx: NodeBuildContext): CSSProperties | undefined {
  if (ctx.isCompareMode) return undefined;
  if (ctx.isPlaying) {
    return { opacity: flowPlaybackOpacity(comp.id, ctx.flowHighlight), filter: "none" };
  }
  if (ctx.isRecording) {
    return {
      opacity: ctx.flowBadges?.badgedNodeIds.has(comp.id) ? 1 : C4_RECORDING_DIM_OPACITY,
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
      flowBadges,
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
  },

  buildStyle: buildC4Style,
};
