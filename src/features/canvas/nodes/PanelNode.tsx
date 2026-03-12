import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Square, ChevronDown, ChevronUp } from "lucide-react";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";

const DEFAULT_COLOR = "hsl(220 20% 20%)";
const DEFAULT_OPACITY = 10;

export interface PanelNodeData {
  elementId: string;
  name: string;
  description?: string;
  panelColor?: string;
  panelOpacity?: number;
  isSelected: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;
  /** Child is being dragged outside this panel — will unparent on drop */
  isUnparentCandidate?: boolean;
  collapsed?: boolean;
  childCount?: number;
  onToggleCollapse?: () => void;
}

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

const UNPARENT_BORDER = "hsl(25 95% 53%)"; // orange

const PanelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as PanelNodeData;
  const { highlightedNodeIds } = useHandleHighlight();
  const color = d.panelColor || DEFAULT_COLOR;
  const opacity = d.panelOpacity ?? DEFAULT_OPACITY;
  const isSelected = selected || d.isSelected;
  const isHighlighted =
    (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const isDragTarget = d.isDragTarget;
  const isUnparentCandidate = d.isUnparentCandidate ?? false;
  const collapsed = d.collapsed ?? false;
  const childCount = d.childCount ?? 0;
  const onToggle = d.onToggleCollapse;

  const bgAlpha = isDragTarget ? Math.min(opacity + 15, 40) / 100 : opacity / 100;
  const borderColor = isUnparentCandidate
    ? UNPARENT_BORDER
    : isActive || isDragTarget
      ? color
      : colorWithAlpha(color, 0.4);
  const borderStyle = isSelected ? "dashed" : "solid";

  const selectedRing = "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110";
  const unselectedClass = "opacity-90";

  if (collapsed) {
    return (
      <div
        className={`w-full h-full rounded-lg flex items-center gap-2 px-3 transition-all duration-200 ${isActive ? selectedRing : unselectedClass}`}
        style={{
          backgroundColor: colorWithAlpha(color, Math.max(bgAlpha, 0.12)),
          border: `2px ${borderStyle} ${borderColor}`,
        }}
      >
        <Square className="h-4 w-4 shrink-0 opacity-80" style={{ color }} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground truncate block">
            {d.name || "Painel"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {childCount} {childCount === 1 ? "elemento" : "elementos"}
          </span>
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-label="Expandir painel"
            aria-expanded={false}
            className="shrink-0 p-1 rounded hover:bg-black/10 text-muted-foreground hover:text-foreground"
            title="Expandir"
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
        className={`w-full h-full rounded-xl backdrop-blur-sm transition-all duration-200 relative ${isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-90"}`}
        style={{
          backgroundColor: colorWithAlpha(color, bgAlpha),
          border: `2px ${borderStyle} ${borderColor}`,
        }}
      >
        {isDragTarget && (
          <div
            className="absolute inset-0 rounded-xl animate-pulse-glow pointer-events-none"
            style={{ boxShadow: `0 0 20px 4px ${colorWithAlpha(color, 0.5)}` }}
          />
        )}
        <div className="flex items-start gap-2 px-3 py-2.5">
          <Square className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color }} />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground truncate block">
              {d.name}
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
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label="Minimizar painel"
              aria-expanded={true}
              className="shrink-0 p-1 rounded hover:bg-black/10 text-muted-foreground hover:text-foreground"
              title="Minimizar"
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
