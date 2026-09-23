import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Position, type Node, type NodeProps } from "@xyflow/react";
import { useCollabHighlight } from "@/features/collaboration/hooks/useCollabHighlight";
import { CollabPeerPresence } from "@/features/canvas/components/CollabPeerPresence";
import { usePeerOnNode } from "@/features/canvas/hooks/usePeerOnNode";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { useResolvedComponentIcon } from "@/features/canvas/components/icons/componentIconLookupContext";
import { cloudRegistry, CloudIcon } from "@/features/cloud";
import { getElement } from "@/features/elements/element.registry";
import { borderClassForAccent } from "@/features/elements/accent-border";
import { MIN_HANDLES, MAX_HANDLES } from "../../canvas.constants";
import { useHandleHighlight } from "../../contexts/HandleHighlightContext";
import type { NodeData } from "./types";
import { TypeConfig } from "./TypeConfig";
import { buildHandles } from "./Handles";
import { Badges } from "./Badges";
import { DrillDownButton } from "./DrillDownButton";
import { EmbedButton } from "./EmbedButton";
import { StepBadge } from "./StepBadge";
import { useTranslation } from "react-i18next";
import { CompareVersionBadges, VersionElementBadge } from "../VersionElementBadge";
import { useCollab } from "@/features/collaboration/components/CollabProvider";
import { CARD_MAX_W, CARD_MIN_W } from "./constants";

/**
 * Remembers the collapsed height and, while active, caps vertical growth at
 * twice that so a long description scrolls instead of stretching the card.
 * Width stays at {@link CARD_MAX_W}.
 */
function useExpandMaxHeight(
  isActive: boolean,
  rootRef: { readonly current: HTMLDivElement | null },
): CSSProperties | undefined {
  const collapsedHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || isActive) return;
    collapsedHeightRef.current = el.offsetHeight;
  });

  const collapsedHeight = collapsedHeightRef.current;
  if (!isActive || collapsedHeight === null) return undefined;
  return { maxHeight: Math.max(collapsedHeight * 2, 1) };
}

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
}

const NodeHandles = ({ d, incomingCount, outgoingCount, handlePointer }: NodeHandlesProps) => {
  return (
    <>
      {buildHandles(incomingCount, "target", Position.Left, d, handlePointer)}
      {/* Left is input only, right is output only — never mirrored by position. */}
      {buildHandles(outgoingCount, "source", Position.Right, d, handlePointer)}
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
  // Drawn whenever the card links somewhere, a control only where it can go:
  // the reader keeps the row (and so the card's size) without the action.
  const hasDrillDown = !!d.linkedDiagramName;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const expandStyle = useExpandMaxHeight(isActive, rootRef);

  const customDiagramIcon = useResolvedComponentIcon(d.elementId);
  const collabHighlight = useCollabHighlight(d.elementId);
  const activePeer = usePeerOnNode(d.elementId);

  const cloudProvider = cloudRegistry.forType(d.type);
  const registered = getElement(d.type);
  const accentBorder =
    registered && !d.customColor ? borderClassForAccent(registered.palette.accent) : "";

  let borderClass: string;
  let borderStyle: CSSProperties | undefined;
  let icon: ReactNode;
  let technologyLabel: string | undefined;
  let actionColorClass: string;

  if (customDiagramIcon) {
    icon = <CustomIconRenderer icon={customDiagramIcon} size={24} className="shrink-0" />;
    if (cloudProvider) {
      const svc = d.cloudService ? cloudProvider.getService(d.cloudService) : undefined;
      const cat = cloudProvider.getCategoryForType(d.type);
      const hasCustomColor = !!d.customColor;
      // Registered cloud categories own their accent; the provider map is the
      // fallback for families that have not migrated yet (AWS, Azure).
      borderClass = !hasCustomColor
        ? accentBorder || cloudProvider.getCategoryStyle(d.type).borderClass
        : "";
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
    const svc = d.cloudService ? cloudProvider.getService(d.cloudService) : undefined;
    const cat = cloudProvider.getCategoryForType(d.type);
    const hasCustomColor = !!d.customColor;
    borderClass = !hasCustomColor
      ? accentBorder || cloudProvider.getCategoryStyle(d.type).borderClass
      : "";
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
      ref={rootRef}
      aria-label={t("cardNode.ariaNamed", { name: d.name, type: d.type })}
      className={`group relative rounded-lg bg-card border border-border ${borderClass} border-l-[3px] transition-shadow duration-200 flex flex-col ${
        isActive
          ? "overflow-hidden ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110"
          : "opacity-90"
      }`}
      style={{
        minWidth: CARD_MIN_W,
        maxWidth: CARD_MAX_W,
        // The box auto-layout anchored the handles against, so the reader draws
        // the same card the editor did — see `laidOutMinHeight`.
        ...(d.laidOutMinHeight !== undefined ? { minHeight: d.laidOutMinHeight } : {}),
        ...borderStyle,
        ...expandStyle,
      }}
    >
      {collabHighlight && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg z-10"
          style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
        />
      )}
      {activePeer && <CollabPeerPresence activePeer={activePeer} roundedClassName="rounded-lg" />}
      {d.compareBadges && <CompareVersionBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
      {!d.compareBadges && d.versionBadge && (
        <VersionElementBadge name={d.versionBadge.name} color={d.versionBadge.color} />
      )}
      {d.stepBadges && d.stepBadges.length > 0 && (
        <StepBadge badges={d.stepBadges} isLastRecorded={d.isLastRecorded} />
      )}
      <NodeHandles
        d={d}
        incomingCount={incomingCount}
        outgoingCount={outgoingCount}
        handlePointer={handlePointer}
      />
      <div
        className={`px-3 py-2.5 flex flex-col min-h-0 ${isActive ? "flex-1 overflow-hidden" : ""}`}
      >
        <div className="flex items-center gap-2 mb-1.5 shrink-0">
          {icon}
          <span
            className={`text-sm font-bold text-foreground leading-tight ${
              isActive ? "whitespace-normal break-words" : "truncate"
            }`}
          >
            {d.name}
          </span>
        </div>
        {d.description && (
          <p
            className={`text-xs text-muted-foreground leading-snug mb-1.5 ${
              isActive
                ? "min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words nowheel nodrag"
                : "line-clamp-2"
            }`}
          >
            {d.description}
          </p>
        )}
        {technologyLabel && (
          <span className="inline-block self-start text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground shrink-0">
            {technologyLabel}
          </span>
        )}
        <div className="shrink-0">
          <NodeActions
            d={d}
            controlsDisabled={controlsDisabled || isGuest}
            colorClass={actionColorClass}
            customColor={d.customColor}
          />
        </div>
      </div>
    </div>
  );
});
CardNode.displayName = "CardNode";

export default CardNode;
export type { NodeData };
