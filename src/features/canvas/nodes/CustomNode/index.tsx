import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { Network } from "lucide-react";
import {
  isAwsType,
  AWS_SERVICE_MAP,
  AWS_CATEGORY_MAP,
} from "@/lib/catalogs/aws";
import AwsIcon from "../AwsIcon";
import { MIN_HANDLES, MAX_HANDLES } from "../../constants";
import { useHandleHighlight } from "../../contexts/HandleHighlightContext";
import type { NodeData } from "./types";
import { TypeConfig, awsCategoryBorders } from "./TypeConfig";
import { buildHandles } from "./Handles";
import { buildReorderControls } from "./ReorderControls";
import { Badges } from "./Badges";
import { DrillDownButton } from "./DrillDownButton";
import { EmbedButton } from "./EmbedButton";
import { RecordingBadge } from "./RecordingBadge";

function useNodeState(data: NodeProps["data"], selected: boolean | undefined) {
  const d = data as unknown as NodeData;
  const { highlightedNodeIds } = useHandleHighlight();
  const isHighlighted = highlightedNodeIds.has(d.elementId);
  const isActive = selected || d.isSelected || d.isHighlighted || isHighlighted;
  const controlsDisabled = !!d.controlsDisabled;

  const handlePointer =
    controlsDisabled
      ? { pointerEvents: "none" as const }
      : d.isRecording || !!d.activeHandleId
        ? { pointerEvents: "all" as const }
        : undefined;

  const incomingCount = Math.min(
    MAX_HANDLES,
    Math.max(MIN_HANDLES, d.incomingCount ?? 1),
  );
  const outgoingCount = Math.min(
    MAX_HANDLES,
    Math.max(MIN_HANDLES, d.outgoingCount ?? 1),
  );

  return { d, isActive, controlsDisabled, handlePointer, incomingCount, outgoingCount };
}

interface NodeHandlesProps {
  d: NodeData;
  incomingCount: number;
  outgoingCount: number;
  handlePointer: React.CSSProperties | undefined;
  controlsDisabled: boolean;
}

const NodeHandles = ({ d, incomingCount, outgoingCount, handlePointer, controlsDisabled }: NodeHandlesProps) => {
  const incomingIds = d.handleOrder?.incoming ?? [];
  const outgoingIds = d.handleOrder?.outgoing ?? [];

  return (
    <>
      {buildHandles(incomingCount, "target", Position.Left, d, handlePointer)}
      {d.onReorderHandle &&
        buildReorderControls(incomingIds, "incoming", controlsDisabled, d.onReorderHandle)}
      {buildHandles(outgoingCount, "source", Position.Right, d, handlePointer)}
      {d.onReorderHandle &&
        buildReorderControls(outgoingIds, "outgoing", controlsDisabled, d.onReorderHandle)}
    </>
  );
};

interface NodeActionsProps {
  d: NodeData;
  controlsDisabled: boolean;
  colorClass: string;
  customColor?: string;
}

const NodeActions = ({ d, controlsDisabled, colorClass, customColor }: NodeActionsProps) => {
  const hasDrillDown = !!d.linkedDiagramName && !!d.onDrillDown;
  const hasEmbed = !!d.linkedDiagramName && !!d.onEmbed;

  return (
    <>
      <Badges
        controlsDisabled={controlsDisabled}
        serviceId={d.serviceId}
        serviceName={d.serviceName}
        linkedDiagramName={d.linkedDiagramName}
      />
      {hasDrillDown && (
        <DrillDownButton
          elementId={d.elementId}
          onDrillDown={d.onDrillDown}
          colorClass={colorClass}
          customColor={customColor}
          disabled={controlsDisabled}
        />
      )}
      {hasEmbed && (
        <EmbedButton
          elementId={d.elementId}
          onEmbed={d.onEmbed}
          disabled={controlsDisabled}
        />
      )}
    </>
  );
};

const AwsNode = memo(({ data, selected }: NodeProps) => {
  const { d, isActive, controlsDisabled, handlePointer, incomingCount, outgoingCount } =
    useNodeState(data, selected);

  const svcInfo = d.awsService ? AWS_SERVICE_MAP.get(d.awsService) : null;
  const catInfo = AWS_CATEGORY_MAP.get(d.type);
  const borderClass = awsCategoryBorders[d.type] ?? "border-l-aws-general";

  return (
    <div
      aria-label={`${d.name} (${d.type})`}
      className={`group relative min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${borderClass} border-l-[3px] transition-shadow duration-200 ${isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-90"}`}
    >
      {d.recordingBadges && d.recordingBadges.length > 0 && (
        <RecordingBadge badges={d.recordingBadges} isLastRecorded={d.isLastRecorded} />
      )}
      <NodeHandles
        d={d}
        incomingCount={incomingCount}
        outgoingCount={outgoingCount}
        handlePointer={handlePointer}
        controlsDisabled={controlsDisabled}
      />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          {svcInfo?.iconName ? (
            <AwsIcon iconName={svcInfo.iconName} size={20} />
          ) : (
            <Network className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-bold text-foreground leading-tight truncate">
            {d.name}
          </span>
        </div>
        {d.description && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">
            {d.description}
          </p>
        )}
        {(d.technology || svcInfo) && (
          <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {d.technology ?? catInfo?.name ?? svcInfo?.name}
          </span>
        )}
        <NodeActions d={d} controlsDisabled={controlsDisabled} colorClass="text-primary" />
      </div>
    </div>
  );
});
AwsNode.displayName = "AwsNode";

const C4Node = memo(({ data, selected }: NodeProps) => {
  const { d, isActive, controlsDisabled, handlePointer, incomingCount, outgoingCount } =
    useNodeState(data, selected);

  const cfg = TypeConfig[d.type] ?? TypeConfig.system;
  const Icon = cfg.icon;
  const hasCustomColor = !!d.customColor;

  return (
    <div
      aria-label={`${d.name} (${d.type})`}
      className={`group relative min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${!hasCustomColor ? cfg.borderColor : ""} border-l-[3px] transition-shadow duration-200 ${isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-90"}`}
      style={hasCustomColor ? { borderLeftColor: d.customColor } : undefined}
    >
      {d.recordingBadges && d.recordingBadges.length > 0 && (
        <RecordingBadge badges={d.recordingBadges} isLastRecorded={d.isLastRecorded} />
      )}
      <NodeHandles
        d={d}
        incomingCount={incomingCount}
        outgoingCount={outgoingCount}
        handlePointer={handlePointer}
        controlsDisabled={controlsDisabled}
      />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon
            className={`h-4 w-4 shrink-0 ${!hasCustomColor ? cfg.textColor : ""}`}
            style={hasCustomColor ? { color: d.customColor } : undefined}
          />
          <span className="text-sm font-bold text-foreground leading-tight truncate">
            {d.name}
          </span>
        </div>
        {d.description && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">
            {d.description}
          </p>
        )}
        {d.technology && (
          <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {d.technology}
          </span>
        )}
        <NodeActions
          d={d}
          controlsDisabled={controlsDisabled}
          colorClass={hasCustomColor ? "" : cfg.textColor}
          customColor={d.customColor}
        />
      </div>
    </div>
  );
});
C4Node.displayName = "C4Node";

const CardNode = memo((props: NodeProps) => {
  const d = props.data as unknown as NodeData;
  const isAws = isAwsType(d.type);

  if (isAws) {
    return <AwsNode {...props} />;
  }
  return <C4Node {...props} />;
});
CardNode.displayName = "CardNode";

export default CardNode;
export type { NodeData };
