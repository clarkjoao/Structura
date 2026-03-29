import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FlowStep } from "@/features/diagram";
import { isConditionStep, isFlowLinkStep } from "@/features/diagram";
import type { BranchOwnerInfo } from "./flowMode.types";
import { getBranchColor } from "./branchColors";
import type { GraphLayout, GraphNode } from "./useBranchGraphLayout";

// ─── Horizontal config (playback) ────────────────────────────────────────────
const H = {
  HP: 10,   // horizontal padding
  VP: 8,    // vertical padding
  NS: 36,   // node spacing (between adjacent nodes along the flow)
  LH: 18,   // lane height (between lanes)
  NR: 5,    // node radius
} as const;

// ─── Vertical config (recording) ─────────────────────────────────────────────
const V = {
  HP: 12,
  VP: 12,
  NS: 44,   // node spacing (between rows)
  LW: 32,   // lane width (between columns)
  NR: 6,    // node radius
  LA: 88,   // label area width reserved to the right
} as const;

function getLaneColor(lane: number): string {
  if (lane === 0) return "hsl(var(--primary))";
  return getBranchColor(lane - 1);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function getVerticalMergeTargetAnchor(
  node: GraphNode,
  cx: number,
  cy: number,
  nrLocal: number,
): { x: number; y: number } {
  if (isConditionStep(node.step)) {
    const halfD = nrLocal + 1;
    return { x: cx, y: cy - halfD };
  }
  if (isFlowLinkStep(node.step)) {
    return { x: cx, y: cy - nrLocal * 0.75 };
  }
  return { x: cx, y: cy - nrLocal };
}

interface FlowBranchGraphProps {
  layout: GraphLayout;
  orientation: "horizontal" | "vertical";
  /** The currently active step id (playback). */
  currentStepId?: string;
  /** Steps already visited during playback — drives fill coloring. */
  visitedStepIds?: Set<string>;
  /** Recording: leaf step ids that are the current tip of a branch/trunk path. */
  activeRecordingBranchTails?: Set<string>;
  /** Recording: branch ownership for active-branch dimming in the map. */
  branchOwnership?: Map<string, BranchOwnerInfo>;
  /** When set with `activeBranchIndex`, non-matching branch nodes render dimmed. */
  activeBranchConditionId?: string | null;
  activeBranchIndex?: number | null;
  /** Highlight a selected step (recording map ↔ panel). */
  selectedStepId?: string | null;
  /** Recording map: click a non-condition step to select it in the step list. */
  onStepSelect?: (stepId: string) => void;
  /** Recording map: condition node click; anchor is SVG coordinates (popover placement). */
  onConditionClick?: (stepId: string, anchor: { cx: number; cy: number }) => void;
  /**
   * Recording overlay: unified click handling (condition vs step select) without changing
   * recording context. When set, overrides `onStepSelect` / `onConditionClick` for node clicks.
   */
  onRecordingMapClick?: (stepId: string, step: FlowStep, graphNode: GraphNode) => void;
  /** Recording: show ⊕ on leaf nodes to add a condition. */
  leafBifurcateEnabled?: boolean;
  /** When set, only this step id may show the leaf ⊕ control (single active recording tail). */
  leafBifurcateAnchorStepId?: string | null;
  onLeafBifurcateClick?: (stepId: string, anchor: { cx: number; cy: number }) => void;
  /** Recording map: flow-link node — confirm remove (does not use branch-select). */
  onRecordingFlowLinkClick?: (stepId: string) => void;
  /** Recording map: click empty area of the graph (clears step selection in overlay). */
  onRecordingMapBackgroundClick?: () => void;
  /** Recording: called when user clicks a node (e.g. FlowPanel branch edit). */
  onNodeClick?: (stepId: string, step: FlowStep) => void;
  /** Recording: dashed lines from condition nodes to their merge (convergence) step. */
  conditionMergeEdges?: { conditionStepId: string; mergeStepId: string }[];
}

function getRecordingNodeDimOpacity(
  stepId: string,
  branchOwnership: Map<string, BranchOwnerInfo> | undefined,
  activeBranchConditionId: string | null | undefined,
  activeBranchIndex: number | null | undefined,
): number {
  if (
    !branchOwnership ||
    activeBranchConditionId === null ||
    activeBranchConditionId === undefined ||
    activeBranchIndex === null ||
    activeBranchIndex === undefined
  ) {
    return 1;
  }
  const owner = branchOwnership.get(stepId);
  if (!owner) return 1;
  if (owner.conditionStepId === activeBranchConditionId && owner.branchIndex === activeBranchIndex) {
    return 1;
  }
  return 0.3;
}

function isActiveBranchMember(
  stepId: string,
  branchOwnership: Map<string, BranchOwnerInfo> | undefined,
  activeBranchConditionId: string | null | undefined,
  activeBranchIndex: number | null | undefined,
): boolean {
  if (
    !branchOwnership ||
    activeBranchConditionId === null ||
    activeBranchConditionId === undefined ||
    activeBranchIndex === null ||
    activeBranchIndex === undefined
  ) {
    return false;
  }
  const owner = branchOwnership.get(stepId);
  return (
    !!owner &&
    owner.conditionStepId === activeBranchConditionId &&
    owner.branchIndex === activeBranchIndex
  );
}

export function FlowBranchGraph({
  layout,
  orientation,
  currentStepId,
  visitedStepIds,
  activeRecordingBranchTails,
  branchOwnership,
  activeBranchConditionId,
  activeBranchIndex,
  selectedStepId,
  onStepSelect,
  onConditionClick,
  onRecordingMapClick,
  leafBifurcateEnabled,
  leafBifurcateAnchorStepId,
  onLeafBifurcateClick,
  onRecordingFlowLinkClick,
  onRecordingMapBackgroundClick,
  onNodeClick,
  conditionMergeEdges,
}: FlowBranchGraphProps) {
  const { t } = useTranslation();
  const [leafBifurcateHoverId, setLeafBifurcateHoverId] = useState<string | null>(null);
  const isH = orientation === "horizontal";
  const { nodes, edges, totalLanes, totalSeq } = layout;

  // ── empty state ──────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    if (!isH) {
      return (
        <div className="flex-1 flex flex-col items-center pt-10 gap-2">
          <div
            className="w-3 h-3 rounded-full border-2 border-dashed border-border"
            style={{ borderColor: "hsl(var(--primary) / 0.4)" }}
          />
          <span className="text-[10px] text-muted-foreground">
            {t("flowRecorder.flowMap.emptyRecordingHint")}
          </span>
        </div>
      );
    }
    return null;
  }

  // ── coordinate helpers ───────────────────────────────────────────────────
  const nodeX = isH
    ? (_lane: number, seq: number) => H.HP + seq * H.NS
    : (lane: number) => V.HP + V.NR + lane * V.LW;

  const nodeY = isH
    ? (lane: number) => H.VP + H.NR + lane * H.LH
    : (_lane: number, seq: number) => V.VP + V.NR + seq * V.NS;

  const nr = isH ? H.NR : V.NR;

  const svgW = isH
    ? H.HP * 2 + Math.max(totalSeq - 1, 0) * H.NS + H.NR * 2
    : V.HP * 2 + Math.max(totalLanes - 1, 0) * V.LW + V.NR * 2 + V.LA;

  const svgH = isH
    ? H.VP * 2 + Math.max(totalLanes - 1, 0) * H.LH + H.NR * 2
    : V.VP * 2 + Math.max(totalSeq - 1, 0) * V.NS + V.NR * 2 + (totalSeq > 0 ? 8 : 0);

  // Pre-compute node pixel positions
  const pos = new Map<string, { cx: number; cy: number }>();
  for (const n of nodes) {
    pos.set(n.id, { cx: nodeX(n.lane, n.seq), cy: nodeY(n.lane, n.seq) });
  }

  // For vertical mode: only show inline labels for rows with a single node
  const seqNodeCount = new Map<number, number>();
  for (const n of nodes) seqNodeCount.set(n.seq, (seqNodeCount.get(n.seq) ?? 0) + 1);

  const isPlayback = visitedStepIds !== undefined;

  const handleNodeInteraction = (graphNode: GraphNode, cx: number, cy: number) => {
    if (!isPlayback && isFlowLinkStep(graphNode.step)) {
      if (onNodeClick) {
        onNodeClick(graphNode.id, graphNode.step);
        return;
      }
      onRecordingFlowLinkClick?.(graphNode.id);
      return;
    }
    if (onRecordingMapClick && !isPlayback) {
      onRecordingMapClick(graphNode.id, graphNode.step, graphNode);
      return;
    }
    if (onStepSelect && !isConditionStep(graphNode.step) && !isFlowLinkStep(graphNode.step)) {
      onStepSelect(graphNode.id);
      return;
    }
    if (onConditionClick && isConditionStep(graphNode.step)) {
      onConditionClick(graphNode.id, { cx, cy });
      return;
    }
    onNodeClick?.(graphNode.id, graphNode.step);
  };

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ overflow: "visible", display: "block" }}
    >
      {onRecordingMapBackgroundClick && !isPlayback ? (
        <rect
          x={0}
          y={0}
          width={svgW}
          height={svgH}
          fill="transparent"
          onClick={() => onRecordingMapBackgroundClick()}
          style={{ cursor: "default" }}
        />
      ) : null}
      {/* ── Edges ─────────────────────────────────────────────────────────── */}
      {edges.map((edge) => {
        const from = pos.get(edge.fromId);
        const to = pos.get(edge.toId);
        if (!from || !to) return null;

        const sameLane = edge.fromLane === edge.toLane;
        const edgeColor = getLaneColor(edge.toLane);

        // Playback: visited edges use primary, unvisited use muted border
        const isEdgeVisited =
          isPlayback &&
          (visitedStepIds!.has(edge.fromId) || edge.fromId === currentStepId);
        const strokeColor = isPlayback
          ? isEdgeVisited
            ? "hsl(var(--primary))"
            : "hsl(var(--border))"
          : edgeColor;
        const strokeOpacity = isPlayback ? (isEdgeVisited ? 0.85 : 0.4) : 0.65;

        let d: string;
        if (sameLane) {
          d = `M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`;
        } else if (isH) {
          const mx = (from.cx + to.cx) / 2;
          d = `M ${from.cx} ${from.cy} C ${mx} ${from.cy}, ${mx} ${to.cy}, ${to.cx} ${to.cy}`;
        } else {
          const my = (from.cy + to.cy) / 2;
          d = `M ${from.cx} ${from.cy} C ${from.cx} ${my}, ${to.cx} ${my}, ${to.cx} ${to.cy}`;
        }

        // Branch label along the edge (vertical recording mode only)
        const showBranchLabel = !isH && !isPlayback && edge.branchLabel && !sameLane;
        const labelX = showBranchLabel ? from.cx + (to.cx - from.cx) * 0.28 : 0;
        const labelY = showBranchLabel ? from.cy + (to.cy - from.cy) * 0.28 - 4 : 0;

        return (
          <g key={`${edge.fromId}-${edge.toId}`}>
            <path
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.5}
              strokeOpacity={strokeOpacity}
            />
            {showBranchLabel && (
              <text
                x={labelX}
                y={labelY}
                fill={edgeColor}
                fontSize={8}
                fontWeight={500}
                opacity={0.9}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {truncate(edge.branchLabel!, 9)}
              </text>
            )}
          </g>
        );
      })}

      {!isPlayback &&
        !isH &&
        conditionMergeEdges?.map(({ conditionStepId, mergeStepId }) => {
          const fromNode = nodes.find((n) => n.id === conditionStepId);
          const toNode = nodes.find((n) => n.id === mergeStepId);
          const from = pos.get(conditionStepId);
          const to = pos.get(mergeStepId);
          if (!fromNode || !toNode || !from || !to || !isConditionStep(fromNode.step)) return null;
          const diamondHalf = nr + 1;
          const mergeStartY = from.cy + diamondHalf;
          const mergeEnd = getVerticalMergeTargetAnchor(toNode, to.cx, to.cy, nr);
          const midY = (mergeStartY + mergeEnd.y) / 2;
          const mergePath = `M ${from.cx} ${mergeStartY} C ${from.cx} ${midY}, ${mergeEnd.x} ${midY}, ${mergeEnd.x} ${mergeEnd.y}`;
          return (
            <path
              key={`merge-edge-${conditionStepId}-${mergeStepId}`}
              d={mergePath}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.25}
              strokeDasharray="4 3"
              strokeOpacity={0.85}
              style={{ pointerEvents: "none" }}
            />
          );
        })}

      {/* ── Nodes ─────────────────────────────────────────────────────────── */}
      {nodes.map((node) => {
        const p = pos.get(node.id);
        if (!p) return null;
        const { cx, cy } = p;

        const isCondition = isConditionStep(node.step);
        const isFlowLink = isFlowLinkStep(node.step);
        const isCurrent = node.id === currentStepId;
        const isVisited = visitedStepIds?.has(node.id) ?? false;
        const isTail = activeRecordingBranchTails?.has(node.id) ?? false;
        const isRecordingClickable =
          (!isPlayback && isFlowLink) ||
          (!!onRecordingMapClick && !isPlayback) ||
          (!!onStepSelect && !isCondition && !isFlowLink) ||
          (!!onConditionClick && isCondition) ||
          !!onNodeClick;
        const laneColor = getLaneColor(node.lane);
        const flowLinkAccent = "hsl(var(--warning))";
        const recordingDimOpacity = !isPlayback
          ? getRecordingNodeDimOpacity(node.id, branchOwnership, activeBranchConditionId, activeBranchIndex)
          : 1;
        const showActiveBranchGlow =
          !isPlayback &&
          !isFlowLink &&
          isActiveBranchMember(node.id, branchOwnership, activeBranchConditionId, activeBranchIndex);

        // Fill/stroke depending on mode
        let fillColor = isPlayback
          ? isCurrent || isVisited
            ? "hsl(var(--primary))"
            : "hsl(var(--background))"
          : laneColor;
        let strokeColor = isPlayback
          ? isCurrent || isVisited
            ? "hsl(var(--primary))"
            : "hsl(var(--border))"
          : laneColor;
        if (isFlowLink) {
          fillColor = "hsl(var(--amber-500) / 0.15)";
          strokeColor = "hsl(var(--amber-500))";
        }
        const fillOpacity = isPlayback ? 1 : 0.9 * recordingDimOpacity;
        const strokeOpacity = !isPlayback ? recordingDimOpacity : undefined;
        const d = nr + 1; // diamond half-diagonal
        let flowLinkTargetLabel = "";
        if (isFlowLinkStep(node.step)) {
          flowLinkTargetLabel = truncate(`→ ${node.step.targetFlowName}`, 12);
        }

        // For vertical mode: show inline label if this is the only node in its row
        const showLabel = !isH && !isPlayback && (seqNodeCount.get(node.seq) ?? 0) === 1;
        const labelText = showLabel
          ? isFlowLink
            ? flowLinkTargetLabel
            : truncate(node.label, 13)
          : "";

        const matchesBifurcateAnchor =
          leafBifurcateAnchorStepId === undefined ||
          leafBifurcateAnchorStepId === null ||
          node.id === leafBifurcateAnchorStepId;
        const isLeafBifurcateTarget =
          !!leafBifurcateEnabled &&
          !isH &&
          !isPlayback &&
          !isCondition &&
          !isFlowLink &&
          isTail &&
          matchesBifurcateAnchor &&
          !!onLeafBifurcateClick;

        return (
          <g
            key={node.id}
            onMouseEnter={() => isLeafBifurcateTarget && setLeafBifurcateHoverId(node.id)}
            onMouseLeave={() => isLeafBifurcateTarget && setLeafBifurcateHoverId(null)}
            onClick={isRecordingClickable ? () => handleNodeInteraction(node, cx, cy) : undefined}
            style={{ cursor: isRecordingClickable ? "pointer" : "default" }}
          >
            <title>{node.label}</title>

            {/* Active tail indicator ring (recording) */}
            {isTail && !isPlayback && !isFlowLink && (
              <circle
                cx={cx}
                cy={cy}
                r={nr + 4}
                fill="none"
                stroke={laneColor}
                strokeWidth={1.5}
                strokeDasharray="3 2"
                opacity={0.55 * recordingDimOpacity}
              />
            )}

            {/* Active branch member glow (recording) */}
            {showActiveBranchGlow && (
              <circle
                cx={cx}
                cy={cy}
                r={nr + (isCondition ? d : nr) + 4}
                fill="none"
                stroke={laneColor}
                strokeWidth={1.5}
                strokeDasharray="3 2"
                opacity={0.55 * recordingDimOpacity}
              />
            )}

            {/* Selected step ring (recording map) */}
            {!isPlayback && selectedStepId === node.id && !isFlowLink && (
              <circle
                cx={cx}
                cy={cy}
                r={nr + (isCondition ? d : nr) + 5}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                opacity={0.65}
              />
            )}
            {!isPlayback && selectedStepId === node.id && isFlowLink && (
              <rect
                x={cx - nr * 1.35 - 3}
                y={cy - nr * 1.05 - 3}
                width={nr * 2.7 + 6}
                height={nr * 2.1 + 6}
                rx={5}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                opacity={0.65}
              />
            )}

            {/* Current step ring (playback) */}
            {isCurrent && isPlayback && !isFlowLink && (
              <circle
                cx={cx}
                cy={cy}
                r={nr + 4}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                opacity={0.3}
              />
            )}
            {isCurrent && isPlayback && isFlowLink && (
              <rect
                x={cx - nr * 1.35 - 4}
                y={cy - nr * 1.05 - 4}
                width={nr * 2.7 + 8}
                height={nr * 2.1 + 8}
                rx={6}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                opacity={0.35}
              />
            )}

            {/* Node shape */}
            {isCondition ? (
              <polygon
                points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeOpacity={strokeOpacity}
                strokeWidth={1.5}
              />
            ) : isFlowLink ? (
              <g>
                <rect
                  x={cx - nr}
                  y={cy - nr * 0.75}
                  width={nr * 2}
                  height={nr * 1.5}
                  rx={3}
                  fill={fillColor}
                  fillOpacity={fillOpacity}
                  stroke={strokeColor}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={1.5}
                />
              </g>
            ) : (
              <circle
                cx={cx}
                cy={cy}
                r={nr}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeOpacity={strokeOpacity}
                strokeWidth={1.5}
              />
            )}

            {/* Inline label (vertical recording, single-node rows) */}
            {showLabel && (
              <text
                x={cx + (isCondition ? d : isFlowLink ? nr * 1.35 : nr) + 6}
                y={cy + 4}
                fill="hsl(var(--foreground))"
                fontSize={9}
                opacity={0.75 * recordingDimOpacity}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {labelText}
              </text>
            )}

            {/* Leaf: add condition (recording) */}
            {isLeafBifurcateTarget && leafBifurcateHoverId === node.id && (
              <g
                onClick={(event) => {
                  event.stopPropagation();
                  const anchorX = cx + nr + 22;
                  onLeafBifurcateClick?.(node.id, { cx: anchorX, cy });
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={cx + nr + 11}
                  cy={cy}
                  r={9}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                />
                <text
                  x={cx + nr + 11}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fill="hsl(var(--primary))"
                  fontSize={11}
                  fontWeight={700}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  ⊕
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default FlowBranchGraph;
