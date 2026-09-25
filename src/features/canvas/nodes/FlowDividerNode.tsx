import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { NodeStrokeMode } from "@/features/diagram/model/component.types";
import { SkinHandles } from "./VsmNodes/SkinHandles";
import { ELEMENT_SIZE_LIMITS } from "./elementSizeLimits";

export type FlowDividerNodeData = {
  elementId: string;
  name: string;
  stroke?: NodeStrokeMode;
  isSelected?: boolean;
};

const DEFAULT_W = 800;
/** The line's box is exactly as tall as its label chip; only the width is resizable. */
const FLOW_DIVIDER_H = 24;

/**
 * A named line: a full-width rule in the muted colour, solid or dashed, with
 * its name in a mono chip at the left end, on the surface with a neutral
 * border so it reads over whatever the line crosses.
 */
const FlowDividerNode = memo(
  ({ data: d, selected, width }: NodeProps<Node<FlowDividerNodeData>>) => {
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = FLOW_DIVIDER_H;
    const dashed = d.stroke === "dashed";

    return (
      <>
        <NodeResizer
          minWidth={ELEMENT_SIZE_LIMITS["flow-divider"].minWidth}
          minHeight={h}
          maxHeight={h}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={{ x: 0, y: h / 2 }} right={{ x: w, y: h / 2 }} w={w} h={h} inert />
        <div className="relative h-full w-full">
          <div
            className="absolute inset-x-0 top-1/2"
            style={{
              borderTop: `1.5px ${dashed ? "dashed" : "solid"} ${
                isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
              }`,
            }}
          />
          <span
            className="absolute left-0 top-1/2 max-w-[60%] -translate-y-1/2 select-none truncate rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase leading-tight"
            style={{
              background: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {d.name}
          </span>
        </div>
      </>
    );
  },
);

FlowDividerNode.displayName = "FlowDividerNode";

export default FlowDividerNode;
