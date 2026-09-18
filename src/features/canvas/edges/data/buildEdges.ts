import type { CSSProperties } from "react";
import type { Edge, MarkerType } from "@xyflow/react";
import type {
  Connection,
  Diagram,
  DiagramModel,
  EdgeControlPoint,
  EdgeLayout,
  FlowStep,
} from "@/features/diagram";
import { EdgeMarker, EdgeStyle } from "@/features/diagram/enums";
import { getEffectiveConnectionStyle } from "@/features/diagram/model/connection-defaults";
import type { FlowHighlight, FlowBadges, CoverageInfo } from "../../flow/flowState";
import {
  OPACITY_FLOW_PLAYBACK_EDGE_DIM,
  OPACITY_FLOW_PLAYBACK_IN_FLIGHT,
  OPACITY_FLOW_PLAYBACK_PARTICIPANT,
  OPACITY_TAG_FILTER_EDGE_DIM,
} from "../../constants/opacity";
import { DIAGRAM_EDGE_RF_TYPE } from "../../core/edgeTypeKey";

/*
 * Leaf imports only: this module is part of the pure projection
 * (`core/projectDiagram.ts`), so it reads the domain enums and helpers
 * directly instead of the `@/features/diagram` barrel, and names React Flow's
 * marker values instead of importing its runtime enum. The values are
 * `MarkerType.Arrow` / `MarkerType.ArrowClosed` from `@xyflow/system`.
 */
/**
 * The stamp for an edge with no waypoints. One shared array, never mutated:
 * a fresh `[]` per build would give every such edge new `data` on every store
 * write, and the editor's per-edge identity cache compares by reference.
 */
const NO_LAYOUT_POINTS: EdgeControlPoint[] = [];

const MARKER_ARROW = "arrow" as MarkerType.Arrow;
const MARKER_ARROW_CLOSED = "arrowclosed" as MarkerType.ArrowClosed;

/** Maps domain connections onto React Flow edges. Pure data — no geometry or React. */

export interface EdgeBuildParams {
  diagram: Diagram | DiagramModel;
  selectedEdgeId: string | null;
  isPlaying: boolean;
  isRecording: boolean;
  isCompareMode?: boolean;

  compareConnectionOpacity?: Record<string, number>;
  activeStep: FlowStep | null;
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds" | "openFrameConnIds">;
  flowBadges: Pick<FlowBadges, "edgeLabels" | "badgedEdgeIds" | "lastEdgeId"> | null;
  coverage: Pick<CoverageInfo, "edgeFlows"> | null;

  tagFilterEdgeDimmed?: boolean;
  /**
   * When set, stamp `layoutPoints` / `layoutLabelOffset` onto every edge — neutral
   * values for an edge with no entry — so EditableEdge draws its resting geometry
   * from the diagram it was handed, never from the store. Both surfaces set it
   * (`projectEdges`); a gesture in progress draws its own local draft instead.
   */
  edgeLayouts?: Record<string, EdgeLayout>;
}

export function toMarkerType(
  marker: string | undefined,
): MarkerType.Arrow | MarkerType.ArrowClosed | undefined {
  if (!marker || marker === EdgeMarker.None) return undefined;
  return marker === EdgeMarker.ArrowClosed ? MARKER_ARROW_CLOSED : MARKER_ARROW;
}

/**
 * React Flow markers use markerUnits="strokeWidth" with viewBox="-10 -10 20 20".
 * The arrow polyline occupies 5/20 (25%) of the viewBox width, so:
 *   visible_px = (5/20) × markerWidth × strokeWidth
 * Default width=12.5 gives only ~3px for strokeWidth=1 — too small.
 * We target ~8px visible width at any strokeWidth by computing the inverse.
 */
function buildMarkerDef(type: MarkerType, strokeWidth: number) {
  const targetPx = 8;
  const w = Math.round(targetPx / (0.25 * strokeWidth));
  const h = Math.round(w * 1.5);
  return { type, width: w, height: h, strokeWidth: 1.5 };
}

export function getEdgeOpacity(
  connId: string,
  isPlaying: boolean,
  isRecording: boolean,
  flowHighlight: Pick<FlowHighlight, "activeConnId" | "participantConnIds" | "openFrameConnIds">,
  flowBadges: Pick<FlowBadges, "badgedEdgeIds"> | null,
): number | undefined {
  if (isPlaying) {
    const isActive = flowHighlight.activeConnId === connId;
    // A call still owed a return is in flight, not merely on the flow.
    const isInFlight = flowHighlight.openFrameConnIds.has(connId);
    const isParticipant = flowHighlight.participantConnIds.has(connId);
    return isActive
      ? 1
      : isInFlight
        ? OPACITY_FLOW_PLAYBACK_IN_FLIGHT
        : isParticipant
          ? OPACITY_FLOW_PLAYBACK_PARTICIPANT
          : OPACITY_FLOW_PLAYBACK_EDGE_DIM;
  }
  if (isRecording && flowBadges) {
    return flowBadges.badgedEdgeIds.has(connId) ? 1 : OPACITY_FLOW_PLAYBACK_EDGE_DIM;
  }
  return undefined;
}

export function buildEdge(
  conn: Connection,
  assignment: { sourceHandle: string; targetHandle: string } | undefined,
  params: EdgeBuildParams,
): Edge {
  const effective = getEffectiveConnectionStyle(conn);
  const isActiveConn = params.isPlaying && params.flowHighlight.activeConnId === conn.id;

  const markerEnd = toMarkerType(effective.markerEnd);
  const markerStart =
    effective.markerStart !== EdgeMarker.None ? toMarkerType(effective.markerStart) : undefined;

  const flowOpacity = getEdgeOpacity(
    conn.id,
    params.isPlaying,
    params.isRecording,
    params.flowHighlight,
    params.flowBadges,
  );
  const compareOp =
    params.isCompareMode && params.compareConnectionOpacity
      ? params.compareConnectionOpacity[conn.id]
      : undefined;
  const opacity = compareOp !== undefined ? compareOp : flowOpacity;
  const tagDimmed = params.tagFilterEdgeDimmed === true;
  const edgeColor = conn.style?.color;
  const stylePayload =
    opacity !== undefined || edgeColor
      ? {
          ...(opacity !== undefined ? { opacity } : {}),
          ...(edgeColor ? { stroke: edgeColor } : {}),
        }
      : undefined;
  const edgeStyle: CSSProperties | undefined = tagDimmed
    ? {
        opacity: OPACITY_TAG_FILTER_EDGE_DIM,
        pointerEvents: "none",
        transition: "opacity 0.2s ease",
      }
    : stylePayload;

  // Read projection: stamp every edge. An edge with no entry gets `[]` / `null`,
  // which resolve to the same default route and label position the editor draws
  // when the store has nothing for it.
  const layoutStamp = params.edgeLayouts
    ? {
        layoutPoints: params.edgeLayouts[conn.id]?.points ?? NO_LAYOUT_POINTS,
        layoutLabelOffset: params.edgeLayouts[conn.id]?.labelOffset ?? null,
      }
    : {};

  return {
    id: conn.id,
    source: conn.sourceId,
    target: conn.targetId,
    sourceHandle: assignment?.sourceHandle,
    targetHandle: assignment?.targetHandle,
    type: DIAGRAM_EDGE_RF_TYPE,
    data: {
      label: conn.label,
      technology: conn.technology,
      color: conn.style?.color,
      connectionId: conn.id,
      stepBadges: params.flowBadges?.edgeLabels.get(conn.id),
      isLastRecorded: params.flowBadges?.lastEdgeId === conn.id,
      coverageFlowNames: params.coverage?.edgeFlows.get(conn.id),
      playbackDuration: isActiveConn ? params.activeStep?.duration : undefined,
      isActivePlayback: isActiveConn,
      activePayload: isActiveConn ? (params.activeStep?.payload ?? null) : null,
      activePayloadDirection: isActiveConn ? (params.activeStep?.payloadDirection ?? null) : null,
      edgeStyle: conn.style?.edgeStyle ?? EdgeStyle.EditableStep,
      strokeStyle: effective.strokeStyle,
      strokeWidth: effective.strokeWidth,
      labelPosition: conn.style?.labelPosition,
      connectionStyle: conn.style,
      ...layoutStamp,
    },
    selected: params.selectedEdgeId === conn.id,
    animated: isActiveConn || (effective.animated && !params.isPlaying),
    markerEnd:
      markerEnd !== undefined ? buildMarkerDef(markerEnd, effective.strokeWidth) : undefined,
    markerStart:
      markerStart !== undefined ? buildMarkerDef(markerStart, effective.strokeWidth) : undefined,
    style: edgeStyle,
  };
}

// Lives with the rest of what the canvas shows, in the pure view module; kept
// exported here for the editor's existing imports.
export { filterVisibleConnections } from "../../core/resolveViewSnapshot";
