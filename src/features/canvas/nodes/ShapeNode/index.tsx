import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { SkinHandles } from "../skin/SkinHandles";
import { SHAPE_DEFAULT_SIZE } from "./shapeSize";
import { useReadingDirection } from "../../contexts/ReadingDirectionContext";
import type { ReadingDirection } from "../node-types/handle-sides";

/** What a pack shape node receives; `paths` and `viewBox` come from the pack, validated. */
export type ShapeNodeData = {
  elementId: string;
  name: string;
  viewBox: string;
  paths: readonly string[];
  /** Outline colour: the node's own, else the lane's, else the neutral stroke. */
  customColor?: string;
  laneAccent?: string;
  isSelected?: boolean;
};

const MIN_SIZE = 32;

/**
 * Where the input and the output sit on the box: the middle of the reading direction's input
 * and output sides (left/right, or top/bottom). The sides themselves are `SkinHandles`' —
 * from `useHandleSides()` — never derived from the outline.
 */
function handlePoints(direction: ReadingDirection, w: number, h: number) {
  return direction === "TB"
    ? { input: { x: w / 2, y: 0 }, output: { x: w / 2, y: h } }
    : { input: { x: 0, y: h / 2 }, output: { x: w, y: h / 2 } };
}

/**
 * An element-pack shape: its SVG outline stretched to the node (`preserveAspectRatio="none"`,
 * strokes kept at one width by `non-scaling-stroke`), the name centred over it.
 *
 * Handles follow ADR-0013 like every element: input and output on the reading direction's
 * sides, never from the outline's geometry.
 */
const ShapeNode = memo(({ data: d, selected, width, height }: NodeProps<Node<ShapeNodeData>>) => {
  const isSelected = !!(selected || d.isSelected);
  const w = width || SHAPE_DEFAULT_SIZE.width;
  const h = height || SHAPE_DEFAULT_SIZE.height;
  const points = handlePoints(useReadingDirection(), w, h);
  const stroke = isSelected
    ? "hsl(var(--primary))"
    : (d.customColor ?? d.laneAccent ?? "hsl(var(--muted-foreground))");

  return (
    <>
      <NodeResizer
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <SkinHandles input={points.input} output={points.output} w={w} h={h} />
      <div className="relative h-full w-full" data-testid="shape-node">
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={d.viewBox}
          preserveAspectRatio="none"
          aria-hidden
        >
          {d.paths.map((path, index) => (
            <path
              key={index}
              d={path}
              fill="hsl(var(--card))"
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <span className="line-clamp-3 select-none text-center text-xs font-medium leading-tight text-foreground">
            {d.name}
          </span>
        </div>
      </div>
    </>
  );
});

ShapeNode.displayName = "ShapeNode";

export default ShapeNode;
