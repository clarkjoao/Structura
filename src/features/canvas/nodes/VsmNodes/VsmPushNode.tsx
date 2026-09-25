import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { SkinHandles } from "./SkinHandles";
import { useSkinPalette, type SkinNodeData } from "./skin";
import { pushArrowPaths } from "./vsmGeometry";

const PRIMARY = "hsl(var(--primary))";
const DEFAULT_W = 110;
const DEFAULT_H = 40;

/**
 * The push arrow, striped, in the accent (slate by default). It annotates the
 * stream between two steps rather than being one, so its handles are inert.
 */
const VsmPushNode = memo(({ data: d, selected, width, height }: NodeProps<Node<SkinNodeData>>) => {
  const palette = useSkinPalette(d, FLOW_DEFAULT_ACCENT);
  const isSelected = !!(selected || d.isSelected);
  const w = width || DEFAULT_W;
  const h = height || DEFAULT_H;
  const { stripes, head, shaft } = pushArrowPaths(w, h);

  return (
    <>
      <NodeResizer
        minWidth={50}
        minHeight={20}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <SkinHandles left={{ x: 0, y: h / 2 }} right={{ x: w, y: h / 2 }} w={w} h={h} inert />
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={d.name}
      >
        <path
          d={shaft}
          fill="none"
          stroke={isSelected ? PRIMARY : palette.accent}
          strokeWidth={1.25}
          strokeDasharray={palette.dashArray}
        />
        {stripes.map((stripe) => (
          <path key={stripe} d={stripe} fill={palette.accent} />
        ))}
        <path
          d={head}
          fill={palette.accent}
          stroke={isSelected ? PRIMARY : palette.accent}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
});

VsmPushNode.displayName = "VsmPushNode";

export default VsmPushNode;
