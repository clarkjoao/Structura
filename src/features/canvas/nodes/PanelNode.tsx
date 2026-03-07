import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";

const DEFAULT_COLOR = "hsl(220 20% 20%)";
const DEFAULT_OPACITY = 10;

export interface PanelNodeData {
  elementId: string;
  name: string;
  description?: string;
  panelColor?: string;
  panelOpacity?: number;
  isSelected: boolean;
  isDragTarget?: boolean;
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

const PanelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as PanelNodeData;
  const color = d.panelColor || DEFAULT_COLOR;
  const opacity = d.panelOpacity ?? DEFAULT_OPACITY;
  const isSelected = selected || d.isSelected;
  const isDragTarget = d.isDragTarget;

  const bgAlpha = isDragTarget ? Math.min(opacity + 15, 40) / 100 : opacity / 100;
  const borderColor = isSelected || isDragTarget ? color : colorWithAlpha(color, 0.4);
  const borderStyle = isSelected ? "dashed" : "solid";

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
        className="w-full h-full rounded-xl backdrop-blur-sm transition-all duration-200 relative"
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
        </div>
      </div>
    </>
  );
});

PanelNode.displayName = "PanelNode";

export default PanelNode;
