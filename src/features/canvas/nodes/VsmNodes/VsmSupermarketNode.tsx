import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { SkinHandles } from "./SkinHandles";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { useSkinPalette, type SkinNodeData } from "./skin";
import { supermarketPath } from "./vsmGeometry";

const PRIMARY = "hsl(var(--primary))";
const DEFAULT_W = 60;
const DEFAULT_H = 72;

/** The supermarket: open shelves drawn at 2.5px in the accent, the name underneath. */
const VsmSupermarketNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<SkinNodeData>>) => {
    const palette = useSkinPalette(d, FLOW_DEFAULT_ACCENT);
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = height || DEFAULT_H;

    return (
      <>
        <NodeResizer
          {...ELEMENT_SIZE_LIMITS["vsm-supermarket"]}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={{ x: 0, y: h / 2 }} right={{ x: w, y: h / 2 }} w={w} h={h} />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={d.name}
        >
          <path
            d={supermarketPath(w, h)}
            fill="none"
            stroke={isSelected ? PRIMARY : palette.accent}
            strokeWidth={2.5}
            strokeDasharray={palette.dashArray}
            strokeLinecap="square"
          />
        </svg>
        <span
          className="pointer-events-none absolute left-1/2 top-full mt-1.5 max-w-[160px] -translate-x-1/2 select-none truncate text-center text-xs font-semibold"
          style={{ color: "hsl(var(--foreground))" }}
        >
          {d.name}
        </span>
      </>
    );
  },
);

VsmSupermarketNode.displayName = "VsmSupermarketNode";

export default VsmSupermarketNode;
