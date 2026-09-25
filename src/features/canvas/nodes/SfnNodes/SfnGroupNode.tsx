import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Repeat, Split } from "lucide-react";
import { mix } from "../ProcessNode/flowAppearance";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { Chip, DeployHandles } from "../DeployNodes/DeployParts";
import { RetryBadge } from "./RetryBadge";

export type SfnGroupNodeData = SkinNodeData & {
  kind: "Parallel" | "Map";
  /** Parallel: where the branch dividers go, node-relative x. */
  dividers: number[];
  itemsPath?: string;
  maxConcurrency?: number;
  retry?: string | null;
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

const HEADER_H = 36;

/**
 * Parallel and Map: sub-containers of a machine, dashed in its pink on a 4%
 * wash. A Parallel's branches are split by dashed dividers; a Map is stacked
 * (its iterator runs once per item) and says its ItemsPath and concurrency.
 */
const SfnGroupNode = memo(({ data: d, selected }: NodeProps<Node<SfnGroupNodeData>>) => {
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  const isSelected = !!(selected || d.isSelected);
  const accent = palette.accent;
  const frame = {
    background: mix(accent, 4, "hsl(var(--card))"),
    border: `1.5px dashed ${mix(accent, 55, "transparent")}`,
  };
  const Icon = d.kind === "Map" ? Repeat : Split;
  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS[d.kind === "Map" ? "sfn-map" : "sfn-parallel"]}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
      />
      {d.kind === "Map" &&
        [10, 5].map((offset) => (
          <div
            key={offset}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{ ...frame, transform: `translate(${offset}px, ${offset}px)` }}
          />
        ))}
      <div
        className={`relative h-full w-full overflow-hidden rounded-xl ${isSelected ? "ring-2 ring-primary" : ""}`}
        style={frame}
      >
        <div className="flex min-w-0 items-center gap-2 px-3" style={{ height: HEADER_H }}>
          <Icon size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />
          <span
            className="min-w-0 select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.kind} · {d.name}
          </span>
          {d.kind === "Map" && (
            <div className="ml-auto flex shrink-0 gap-1">
              {d.itemsPath && <Chip>{d.itemsPath}</Chip>}
              {d.maxConcurrency !== undefined && <Chip>max {d.maxConcurrency}</Chip>}
            </div>
          )}
        </div>
        {d.dividers.map((x) => (
          <div
            key={x}
            aria-hidden
            className="pointer-events-none absolute bottom-2"
            style={{
              left: x,
              top: HEADER_H,
              borderLeft: `1.5px dashed ${mix(accent, 45, "transparent")}`,
            }}
          />
        ))}
      </div>
      {d.retry && <RetryBadge text={d.retry} />}
    </>
  );
});
SfnGroupNode.displayName = "SfnGroupNode";

export default SfnGroupNode;
