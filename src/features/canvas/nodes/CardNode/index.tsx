import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { useCollabHighlight } from "@/features/collaboration/hooks/useCollabHighlight";
import { CollabPeerPresence } from "@/features/canvas/components/CollabPeerPresence";
import { useIsNodeLocked, usePeerOnNode } from "@/features/canvas/hooks/usePeerOnNode";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { useResolvedComponentIcon } from "@/features/canvas/components/icons/componentIconLookupContext";
import { cloudRegistry, CloudIcon } from "@/features/cloud";
import { getElement } from "@/features/elements/element.registry";
import { borderClassForAccent } from "@/features/elements/accent-border";
import { MIN_HANDLES, MAX_HANDLES } from "../../canvas.constants";
import { useIsNodeHandleHighlighted } from "../../contexts/highlightMembership";
import type { NodeData } from "./types";
import { TypeConfig } from "./TypeConfig";
import { buildHandles } from "./Handles";
import { Badges } from "./Badges";
import { DrillDownButton } from "./DrillDownButton";
import { EmbedButton } from "./EmbedButton";
import { StepBadge } from "./StepBadge";
import { useTranslation } from "react-i18next";
import { CompareVersionBadges, VersionElementBadge } from "../VersionElementBadge";
import { useIsCollabGuest } from "@/features/collaboration/hooks/useIsCollabGuest";
import { CARD_MAX_W, CARD_MIN_W } from "./constants";
import { holdCardExpanded } from "./expandedCards";
import { useHandleSides } from "../../contexts/ReadingDirectionContext";
import { useSelectionDisablesControls } from "../../selection/selectionControls";

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

/**
 * Tells the editor's measurement write-back that this card is expanded, so a
 * passing expansion is never stored as its height (see `expandedCards`).
 * A layout effect: it is in place before React Flow's ResizeObserver reports
 * the expanded box, and gone before it reports the resting one.
 */
function useHoldExpanded(isActive: boolean, elementId: string): void {
  useLayoutEffect(
    () => (isActive ? holdCardExpanded(elementId) : undefined),
    [isActive, elementId],
  );
}

/** What the card draws of its own content: a change here is an edit, not a passing state. */
function contentKey(d: NodeData): string {
  return JSON.stringify([
    d.type,
    d.name,
    d.description,
    d.technology,
    d.cloudService,
    d.serviceId,
    d.linkedDiagramId,
    d.externalLinks?.length ?? 0,
  ]);
}

/**
 * The laid-out height the card declares, while it still holds what it was laid
 * out with. Once its content is edited on this mount the floor is released:
 * the card takes the height of what it now holds, React Flow measures that and
 * the editor writes it back, and from then on the stored height is that one.
 * Without the release a card would never shrink after losing a row — its own
 * measurement is what feeds the floor.
 */
function useLaidOutFloor(d: NodeData): number | undefined {
  const key = contentKey(d);
  const [laidOutKey] = useState(key);
  return key === laidOutKey ? d.laidOutMinHeight : undefined;
}

function useNodeState(d: NodeData, selected: boolean | undefined) {
  const isHighlighted = useIsNodeHandleHighlighted(d.elementId);
  const isActive = selected || d.isSelected || d.isHighlighted || isHighlighted;

  const incomingCount = Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, d.incomingCount ?? 1));
  const outgoingCount = Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, d.outgoingCount ?? 1));

  return { d, isActive, incomingCount, outgoingCount };
}

/**
 * Whether the card's controls are off: always on a read-only surface, and
 * while something else is selected. Read by the controls themselves, not by
 * the card: a selection change re-renders them, never the whole card.
 */
function useControlsDisabled(d: NodeData): boolean {
  const disabledBySelection = useSelectionDisablesControls(d.elementId);
  return !!d.controlsDisabled || disabledBySelection;
}

interface NodeHandlesProps {
  d: NodeData;
  incomingCount: number;
  outgoingCount: number;
}

const NodeHandles = ({ d, incomingCount, outgoingCount }: NodeHandlesProps) => {
  const sides = useHandleSides();
  const controlsDisabled = useControlsDisabled(d);
  const handlePointer: CSSProperties | undefined = controlsDisabled
    ? { pointerEvents: "none" }
    : d.isRecording || !!d.activeHandleId
      ? { pointerEvents: "all" }
      : undefined;
  return (
    <>
      {buildHandles(incomingCount, "target", sides.input, d, handlePointer)}
      {/* Input and output sides come from the reading direction — never from position. */}
      {buildHandles(outgoingCount, "source", sides.output, d, handlePointer)}
    </>
  );
};

interface NodeActionsProps {
  d: NodeData;
  colorClass: string;
  customColor?: string;
}

const NodeActions = ({ d, colorClass, customColor }: NodeActionsProps) => {
  const isGuest = useIsCollabGuest();
  const controlsDisabled = useControlsDisabled(d) || isGuest;
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
  const { d, isActive, incomingCount, outgoingCount } = useNodeState(data, selected);
  const rootRef = useRef<HTMLDivElement>(null);
  const expandStyle = useExpandMaxHeight(isActive, rootRef);
  useHoldExpanded(isActive, d.elementId);
  const laidOutFloor = useLaidOutFloor(d);

  const customDiagramIcon = useResolvedComponentIcon(d.elementId);
  const collabHighlight = useCollabHighlight(d.elementId);
  const activePeer = usePeerOnNode(d.elementId);
  const peerLocked = useIsNodeLocked(d.elementId);

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
        // While recording, the node the last step landed on wears a halo — the next click
        // continues from here. It wins over the selection ring, which would also clip its badge.
        d.isRecording && d.isLastRecorded
          ? "ring-2 ring-primary shadow-[0_0_0_10px_hsl(var(--primary)/0.16)]"
          : isActive
            ? "overflow-hidden ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110"
            : "opacity-90"
      }`}
      style={{
        minWidth: CARD_MIN_W,
        maxWidth: CARD_MAX_W,
        // The box auto-layout anchored the handles against, so the editor and
        // the reader draw the same card — see `laidOutMinHeight`.
        ...(laidOutFloor !== undefined ? { minHeight: laidOutFloor } : {}),
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
      {activePeer && (
        <CollabPeerPresence user={activePeer} locked={peerLocked} roundedClassName="rounded-lg" />
      )}
      {d.compareBadges && <CompareVersionBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
      {!d.compareBadges && d.versionBadge && (
        <VersionElementBadge name={d.versionBadge.name} color={d.versionBadge.color} />
      )}
      {d.stepBadges && d.stepBadges.length > 0 && (
        <StepBadge badges={d.stepBadges} isLastRecorded={d.isLastRecorded} />
      )}
      <NodeHandles d={d} incomingCount={incomingCount} outgoingCount={outgoingCount} />
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
            data-lod-secondary
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
          <span
            data-lod-secondary
            className="inline-block self-start text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground shrink-0"
          >
            {technologyLabel}
          </span>
        )}
        <div data-lod-secondary className="shrink-0">
          <NodeActions d={d} colorClass={actionColorClass} customColor={d.customColor} />
        </div>
      </div>
    </div>
  );
});
CardNode.displayName = "CardNode";

export default CardNode;
export type { NodeData };
