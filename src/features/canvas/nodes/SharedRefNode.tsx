import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Link2 } from "lucide-react";
import { Chip, DeployHandles } from "./DeployNodes/DeployParts";
import { ELEMENT_SIZE_LIMITS } from "./elementSizeLimits";

export type SharedRefNodeData = {
  elementId: string;
  /** The original's name: a reference has none of its own to show. */
  name: string;
  accent: string;
  /** The original is gone: the reference is drawn as broken. */
  dangling: boolean;
  isSelected?: boolean;
  incomingCount: number;
  outgoingCount: number;
};

/**
 * A reference to a shared element: a dashed card in the original's accent,
 * the link glyph, the original's name and a `ref` chip.
 */
const SharedRefNode = memo(({ data: d, selected }: NodeProps<Node<SharedRefNodeData>>) => {
  const isSelected = !!(selected || d.isSelected);
  const accent = d.dangling ? "hsl(var(--destructive))" : d.accent;
  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS["shared-ref"]}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
      />
      <div
        className={`flex h-full w-full items-center gap-2 rounded-lg px-3 ${isSelected ? "ring-2 ring-primary" : ""}`}
        style={{
          background: `color-mix(in srgb, ${accent} 6%, hsl(var(--card)))`,
          border: `1.5px dashed color-mix(in srgb, ${accent} 60%, transparent)`,
        }}
      >
        <Link2 size={16} strokeWidth={1.75} color={accent} className="shrink-0" />
        <span className="min-w-0 flex-1 select-none truncate text-sm font-semibold text-foreground">
          {d.name}
        </span>
        <Chip>ref</Chip>
      </div>
    </>
  );
});
SharedRefNode.displayName = "SharedRefNode";

export default SharedRefNode;
