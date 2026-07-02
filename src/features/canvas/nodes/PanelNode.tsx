import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useComponentIcon } from "@/features/diagram";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import AwsIcon from "./AwsIcon";
import { useTranslation } from "react-i18next";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";
import { CollabPeerPresence } from "@/features/canvas/components/CollabPeerPresence";
import { usePeerOnNode } from "@/features/canvas/hooks/usePeerOnNode";

const DEFAULT_OPACITY = 10;

export type PanelNodeData = {
  elementId: string;
  name: string;
  description?: string;
  panelKind?: string;

  awsIconName?: string;
  panelColor?: string;
  panelOpacity?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  isSelected: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;

  isUnparentCandidate?: boolean;
  collapsed?: boolean;
  childCount?: number;
  onToggleCollapse?: () => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const hslMatch = color.match(/hsl\(([^)]+)\)/);
  if (hslMatch) {
    return `hsl(${hslMatch[1]} / ${alpha})`;
  }
  return color;
}

const UNPARENT_BORDER = "hsl(25 95% 53%)";

const PanelNode = memo(({ data: d, selected }: NodeProps<Node<PanelNodeData>>) => {
  const { t } = useTranslation();
  const customDiagramIcon = useComponentIcon(d.elementId);
  const { highlightedNodeIds } = useHandleHighlight();
  const kindDef = getPanelKindDef(
    d.panelKind as import("@/features/diagram").PanelKind | undefined,
  );
  const color = d.panelColor || kindDef.defaultColor;
  const useAwsIcon = d.awsIconName ?? kindDef.awsIconName;
  const Icon = kindDef.icon;
  const opacity = d.panelOpacity ?? DEFAULT_OPACITY;
  const isSelected = selected || d.isSelected;
  const isHighlighted = (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const isDragTarget = d.isDragTarget;
  const isUnparentCandidate = d.isUnparentCandidate ?? false;
  const collapsed = d.collapsed ?? false;
  const childCount = d.childCount ?? 0;
  const onToggle = d.onToggleCollapse;

  const bgAlpha = isDragTarget ? Math.min(opacity + 15, 40) / 100 : opacity / 100;
  const isTransparent = opacity === 0;
  const collabHighlight = useCollabHighlight(d.elementId);
  const activePeer = usePeerOnNode(d.elementId);
  const backgroundColor = isTransparent
    ? "transparent"
    : colorWithAlpha(color, isDragTarget ? bgAlpha : collapsed ? Math.max(bgAlpha, 0.12) : bgAlpha);
  const borderColor = isUnparentCandidate
    ? UNPARENT_BORDER
    : isActive || isDragTarget
      ? color
      : colorWithAlpha(color, 0.4);
  const borderStyle = (d.borderStyle ?? "solid") as "solid" | "dashed" | "dotted";

  const selectedRing = "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110";
  const unselectedClass = "opacity-90";

  if (collapsed) {
    return (
      <div
        className={`relative w-full h-full rounded-lg flex items-center gap-2 px-3 transition-all duration-200 ${isActive ? selectedRing : unselectedClass}`}
        style={{
          backgroundColor,
          border: `2px ${borderStyle} ${borderColor}`,
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
        {customDiagramIcon ? (
          <div className="shrink-0 opacity-80" style={{ color }}>
            <CustomIconRenderer icon={customDiagramIcon} size={24} />
          </div>
        ) : useAwsIcon ? (
          <div className="shrink-0 opacity-80" style={{ color }}>
            <AwsIcon iconName={useAwsIcon} size={18} />
          </div>
        ) : (
          <Icon className="h-4 w-4 shrink-0 opacity-80" style={{ color }} />
        )}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground truncate block">
            {d.name || t("panelNode.defaultName")}
          </span>
          <span className="text-[8px] text-muted-foreground text-nowrap truncate">
            {d?.panelKind !== "default" ? `${kindDef.label}` : ""}
            {d?.panelKind !== "default" ? " - " : ""}
            {t("panelNode.childElements", { count: childCount })}
          </span>
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={t("panelNode.expandAria")}
            aria-expanded={false}
            className="shrink-0 p-1 rounded hover:bg-black/10 text-muted-foreground hover:text-foreground"
            title={t("panelNode.expandTitle")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2.5 !h-2.5 !border-background !rounded-sm"
        handleStyle={{ backgroundColor: color }}
      />
      <div
        className={`w-full h-full rounded-xl transition-all duration-200 relative ${!isTransparent ? "backdrop-blur-sm" : ""} ${isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-90"}`}
        style={{
          backgroundColor,
          border: `2px ${borderStyle} ${borderColor}`,
        }}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-xl z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {activePeer && <CollabPeerPresence activePeer={activePeer} roundedClassName="rounded-xl" />}
        {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
        {!d.compareBadges && d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}
        {isDragTarget && (
          <div
            className="absolute inset-0 rounded-xl animate-pulse-glow pointer-events-none"
            style={{ boxShadow: `0 0 20px 4px ${colorWithAlpha(color, 0.5)}` }}
          />
        )}
        <div className="flex items-start gap-2 px-3 py-2.5">
          {customDiagramIcon ? (
            <div className="shrink-0 mt-0.5" style={{ color }}>
              <CustomIconRenderer icon={customDiagramIcon} size={24} />
            </div>
          ) : useAwsIcon ? (
            <div className="shrink-0 mt-0.5" style={{ color }}>
              <AwsIcon iconName={useAwsIcon} size={18} />
            </div>
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color }} />
          )}
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground truncate block">
              {d?.panelKind !== "default" ? `${kindDef.label} - ${d.name}` : d.name}
            </span>
            {d.description && (
              <span className="text-xs text-muted-foreground line-clamp-1 block">
                {d.description}
              </span>
            )}
          </div>
          {onToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={t("panelNode.collapseAria")}
              aria-expanded={true}
              className="shrink-0 p-1 rounded hover:bg-black/10 text-muted-foreground hover:text-foreground"
              title={t("panelNode.collapseTitle")}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
});

PanelNode.displayName = "PanelNode";

export default PanelNode;
