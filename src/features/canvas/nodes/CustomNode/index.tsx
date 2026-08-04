import { memo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import { useCollabHighlight } from "@/features/collaboration";
import { CollabPeerPresence } from "@/features/canvas/components/CollabPeerPresence";
import { usePeerOnNode } from "@/features/canvas/hooks/usePeerOnNode";
import { useComponentIcon } from "@/features/diagram";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { cloudRegistry, CloudIcon } from "@/features/cloud";
import { MIN_HANDLES, MAX_HANDLES } from "../../canvas.constants";
import { useHandleHighlight } from "../../contexts/HandleHighlightContext";
import type { NodeData } from "./types";
import { TypeConfig } from "./TypeConfig";
import { buildHandles } from "./Handles";
import { buildReorderControls } from "./ReorderControls";
import { Badges } from "./Badges";
import { DrillDownButton } from "./DrillDownButton";
import { EmbedButton } from "./EmbedButton";
import { RecordingBadge } from "./RecordingBadge";
import { useTranslation } from "react-i18next";
import { CompareSceneBadges, SceneElementBadge } from "../SceneElementBadge";
import { useCollab } from "@/features/collaboration";

function useNodeState(d: NodeData, selected: boolean | undefined) {
  const { highlightedNodeIds } = useHandleHighlight();
  const isHighlighted = highlightedNodeIds.has(d.elementId);
  const isActive = selected || d.isSelected || d.isHighlighted || isHighlighted;
  const controlsDisabled = !!d.controlsDisabled;

  const handlePointer = controlsDisabled
    ? { pointerEvents: "none" as const }
    : d.isRecording || !!d.activeHandleId
      ? { pointerEvents: "all" as const }
      : undefined;

  const incomingCount = Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, d.incomingCount ?? 1));
  const outgoingCount = Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, d.outgoingCount ?? 1));

  return { d, isActive, controlsDisabled, handlePointer, incomingCount, outgoingCount };
}

interface NodeHandlesProps {
  d: NodeData;
  incomingCount: number;
  outgoingCount: number;
  handlePointer: CSSProperties | undefined;
  controlsDisabled: boolean;
}

const NodeHandles = ({
  d,
  incomingCount,
  outgoingCount,
  handlePointer,
  controlsDisabled,
}: NodeHandlesProps) => {
  const incomingIds = d.handleOrder?.incoming ?? [];
  const outgoingIds = d.handleOrder?.outgoing ?? [];

  return (
    <>
      {buildHandles(incomingCount, "target", Position.Left, d, handlePointer)}
      {d.onReorderHandle &&
        buildReorderControls(incomingIds, "incoming", controlsDisabled, d.onReorderHandle)}
      {buildHandles(outgoingCount, "source", Position.Right, d, handlePointer)}
      {/* Mirrored sides, used when the other end of the edge sits further left. */}
      {(d.outgoingLeftCount ?? 0) > 0 &&
        buildHandles(d.outgoingLeftCount ?? 0, "source", Position.Left, d, handlePointer, "l-")}
      {(d.incomingRightCount ?? 0) > 0 &&
        buildHandles(d.incomingRightCount ?? 0, "target", Position.Right, d, handlePointer, "r-")}
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
        externalLinks={d.externalLinks}
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
        <EmbedButton elementId={d.elementId} onEmbed={d.onEmbed} disabled={controlsDisabled} />
      )}
    </>
  );
};

const CardNode = memo(({ data, selected }: NodeProps<Node<NodeData>>) => {
  const { t } = useTranslation();
  const { d, isActive, controlsDisabled, handlePointer, incomingCount, outgoingCount } =
    useNodeState(data, selected);
  const { isGuest } = useCollab();

  const customDiagramIcon = useComponentIcon(d.elementId);
  const collabHighlight = useCollabHighlight(d.elementId);
  const activePeer = usePeerOnNode(d.elementId);

  const cloudProvider = cloudRegistry.forType(d.type);

  let borderClass: string;
  let borderStyle: CSSProperties | undefined;
  let icon: ReactNode;
  let technologyLabel: string | undefined;
  let actionColorClass: string;

  if (customDiagramIcon) {
    icon = <CustomIconRenderer icon={customDiagramIcon} size={24} className="shrink-0" />;
    if (cloudProvider) {
      const svc = d.awsService ? cloudProvider.getService(d.awsService) : undefined;
      const cat = cloudProvider.getCategoryForType(d.type);
      const hasCustomColor = !!d.customColor;
      borderClass = !hasCustomColor ? cloudProvider.getCategoryStyle(d.type).borderClass : "";
      borderStyle = hasCustomColor ? { borderLeftColor: d.customColor } : undefined;
      technologyLabel = d.technology ?? cat?.name ?? svc?.name;
      actionColorClass = hasCustomColor ? "" : "text-primary";
    } else {
      const cfg = TypeConfig[d.type] ?? TypeConfig.system;
      const hasCustomColor = !!d.customColor;
      borderClass = !hasCustomColor ? cfg.borderColor : "";
      borderStyle = hasCustomColor ? { borderLeftColor: d.customColor } : undefined;
      technologyLabel = d.technology;
      actionColorClass = hasCustomColor ? "" : cfg.textColor;
    }
  } else if (cloudProvider) {
    const svc = d.awsService ? cloudProvider.getService(d.awsService) : undefined;
    const cat = cloudProvider.getCategoryForType(d.type);
    const hasCustomColor = !!d.customColor;
    borderClass = !hasCustomColor ? cloudProvider.getCategoryStyle(d.type).borderClass : "";
    borderStyle = hasCustomColor ? { borderLeftColor: d.customColor } : undefined;
    icon = <CloudIcon componentType={d.type} serviceIconName={svc?.iconName} size={20} />;
    technologyLabel = d.technology ?? cat?.name ?? svc?.name;
    actionColorClass = hasCustomColor ? "" : "text-primary";
  } else {
    const cfg = TypeConfig[d.type] ?? TypeConfig.system;
    const hasCustomColor = !!d.customColor;
    const Icon = cfg.icon;
    borderClass = !hasCustomColor ? cfg.borderColor : "";
    borderStyle = hasCustomColor ? { borderLeftColor: d.customColor } : undefined;
    icon = (
      <Icon
        className={`h-4 w-4 shrink-0 ${!hasCustomColor ? cfg.textColor : ""}`}
        style={hasCustomColor ? { color: d.customColor } : undefined}
      />
    );
    technologyLabel = d.technology;
    actionColorClass = hasCustomColor ? "" : cfg.textColor;
  }

  return (
    <div
      aria-label={t("customNode.ariaNamed", { name: d.name, type: d.type })}
      className={`group relative min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${borderClass} border-l-[3px] transition-shadow duration-200 ${
        isActive
          ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110"
          : "opacity-90"
      }`}
      style={{
        ...borderStyle,
      }}
    >
      {collabHighlight && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg z-10"
          style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
        />
      )}
      {activePeer && <CollabPeerPresence activePeer={activePeer} roundedClassName="rounded-lg" />}
      {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
      {!d.compareBadges && d.sceneBadge && (
        <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
      )}
      {d.recordingBadges && d.recordingBadges.length > 0 && (
        <RecordingBadge badges={d.recordingBadges} isLastRecorded={d.isLastRecorded} />
      )}
      {(d.journeyCount ?? 0) > 0 && d.journeyNames && d.journeyNames.length > 0 && (
        <div
          title={t("walkthroughs.badge.tooltip", {
            names: d.journeyNames.join(", "),
          })}
          className="pointer-events-none absolute -bottom-1 -right-1 z-10 flex items-center gap-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary"
        >
          <span aria-hidden>✦</span>
          <span>{d.journeyCount}</span>
        </div>
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
          {icon}
          <span className="text-sm font-bold text-foreground leading-tight truncate">{d.name}</span>
        </div>
        {d.description && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">
            {d.description}
          </p>
        )}
        {technologyLabel && (
          <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {technologyLabel}
          </span>
        )}
        <NodeActions
          d={d}
          controlsDisabled={controlsDisabled || isGuest}
          colorClass={actionColorClass}
          customColor={d.customColor}
        />
      </div>
    </div>
  );
});
CardNode.displayName = "CardNode";

export default CardNode;
export type { NodeData };
