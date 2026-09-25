import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { SkinHandles } from "./SkinHandles";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { useSkinPalette, type SkinNodeData } from "./skin";
import { VSM_AMBER } from "./vsmAccents";
import { kaizenBurstPath } from "./vsmGeometry";

const PRIMARY = "hsl(var(--primary))";
const DEFAULT_W = 150;
const DEFAULT_H = 96;

/**
 * The kaizen burst: an irregular 18-point star washed with the accent (amber
 * by default) and outlined in it, the improvement written in the middle. Not
 * connectable: it marks a place on the stream.
 */
const VsmKaizenNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<SkinNodeData>>) => {
    const palette = useSkinPalette(d, VSM_AMBER);
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = height || DEFAULT_H;

    return (
      <>
        <NodeResizer
          {...ELEMENT_SIZE_LIMITS["vsm-kaizen"]}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={{ x: 0, y: h / 2 }} right={{ x: w, y: h / 2 }} w={w} h={h} inert />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden
        >
          <path
            d={kaizenBurstPath(w, h)}
            fill={palette.solid ? palette.accent : palette.tint}
            stroke={isSelected ? PRIMARY : palette.accentOutline}
            strokeWidth={isSelected ? 2.5 : 1.5}
            strokeDasharray={palette.dashArray}
            strokeLinejoin="round"
          />
        </svg>
        <div className="pointer-events-none absolute inset-[24%] flex items-center justify-center text-center">
          <span
            className="select-none text-xs font-semibold leading-tight line-clamp-3 break-words"
            style={{ color: palette.title }}
          >
            {d.name}
          </span>
        </div>
      </>
    );
  },
);

VsmKaizenNode.displayName = "VsmKaizenNode";

export default VsmKaizenNode;
