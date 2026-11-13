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
  /** Made by the auto-layout: drawn as a compact pill rather than a card. */
  auto?: boolean;
  isSelected?: boolean;
  incomingCount: number;
  outgoingCount: number;
};

/**
 * A reference to a shared element: a dashed card in the original's accent,
 * the link glyph, the original's name and a `ref` chip.
 *
 * One the auto-layout made is a pill: the glyph and the name, smaller and
 * lighter. The auto-layout makes one for every far connection, so it should
 * weigh as little as it can beside the elements it serves.
 */
const SharedRefNode = memo(({ data: d, selected }: NodeProps<Node<SharedRefNodeData>>) => {
  const isSelected = !!(selected || d.isSelected);
  const accent = d.dangling ? "hsl(var(--destructive))" : d.accent;
  const compact = d.auto === true;
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
        data-compact={compact || undefined}
        className={`flex h-full w-full items-center ${
          compact ? "gap-1.5 rounded-full px-2.5" : "gap-2 rounded-lg px-3"
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
        style={{
          background: `color-mix(in srgb, ${accent} ${compact ? 4 : 6}%, hsl(var(--card)))`,
          border: `${compact ? 1 : 1.5}px dashed color-mix(in srgb, ${accent} ${
            compact ? 45 : 60
          }%, transparent)`,
        }}
      >
        <Link2 size={compact ? 13 : 16} strokeWidth={1.75} color={accent} className="shrink-0" />
        <span
          className={`min-w-0 flex-1 select-none truncate text-foreground ${
            compact ? "text-xs font-medium" : "text-sm font-semibold"
          }`}
        >
          {d.name}
        </span>
        {!compact && <Chip>ref</Chip>}
      </div>
    </>
  );
});
SharedRefNode.displayName = "SharedRefNode";

export default SharedRefNode;
