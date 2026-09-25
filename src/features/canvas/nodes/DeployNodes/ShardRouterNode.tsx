import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { DeployHandles } from "./DeployParts";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";

export type ShardRouterNodeData = SkinNodeData & { incomingCount: number; outgoingCount: number };

/** The router in front of the shards: a slate card with the shuffle glyph. */
const ShardRouterNode = memo(({ data: d, selected }: NodeProps<Node<ShardRouterNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.laneAccent ?? FLOW_DEFAULT_ACCENT);
  const isSelected = !!(selected || d.isSelected);
  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS["deploy-shard-router"]}
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
        className={`flex h-full w-full items-center gap-2 overflow-hidden rounded-lg px-3 shadow-sm ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        style={{
          background: palette.surface,
          border: `1px ${palette.borderStyle} ${palette.border}`,
          borderLeft: `3px solid ${palette.accent}`,
        }}
      >
        <Shuffle size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />
        <div className="min-w-0">
          <p
            className="select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.name}
          </p>
          <p className="select-none truncate text-xs" style={{ color: palette.muted }}>
            {t("deploy.router")}
          </p>
        </div>
      </div>
    </>
  );
});

ShardRouterNode.displayName = "ShardRouterNode";

export default ShardRouterNode;
