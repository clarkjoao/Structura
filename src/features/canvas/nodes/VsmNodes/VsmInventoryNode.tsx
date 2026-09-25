import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { SkinHandles } from "./SkinHandles";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { useSkinPalette, type SkinNodeData } from "./skin";
import { VSM_AMBER } from "./vsmAccents";
import { inventoryHandles, inventoryTriangle } from "./vsmGeometry";

export type VsmInventoryNodeData = SkinNodeData & { quantity?: string; duration?: string };

const PRIMARY = "hsl(var(--primary))";
const DEFAULT_W = 96;
const DEFAULT_H = 110;

/**
 * Inventory: a triangle washed with the accent (amber by default) and
 * outlined in it, a bold I in the middle, and the quantity and duration as
 * chips underneath.
 */
const VsmInventoryNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<VsmInventoryNodeData>>) => {
    const palette = useSkinPalette(d, VSM_AMBER);
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = height || DEFAULT_H;
    const triangle = inventoryTriangle(w, h);
    const handles = inventoryHandles(w, h);
    const chips = [d.quantity, d.duration].filter((chip): chip is string => !!chip);

    return (
      <>
        <NodeResizer
          {...ELEMENT_SIZE_LIMITS["vsm-inventory"]}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={handles.left} right={handles.right} w={w} h={h} />
        <div className="relative h-full w-full">
          <svg
            className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
            viewBox={`0 0 ${w} ${h}`}
            aria-hidden
          >
            <path
              d={triangle.path}
              fill={palette.solid ? palette.accent : palette.tint}
              stroke={isSelected ? PRIMARY : palette.accentOutline}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={palette.dashArray}
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 select-none text-[20px] font-bold leading-none"
            style={{
              top: triangle.height * 0.52,
              color: palette.solid ? palette.title : palette.accent,
            }}
            aria-label={d.name}
          >
            I
          </span>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1"
            style={{ height: h - triangle.height }}
          >
            {chips.map((chip) => (
              <span
                key={chip}
                className="max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight"
                style={{ background: palette.chipBg, color: palette.chipText }}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </>
    );
  },
);

VsmInventoryNode.displayName = "VsmInventoryNode";

export default VsmInventoryNode;
