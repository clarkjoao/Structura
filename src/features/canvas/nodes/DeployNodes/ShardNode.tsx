import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Flame, HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { Chip, DeployHandles } from "./DeployParts";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";

export type ShardNodeData = SkinNodeData & {
  keyRange?: string;
  region?: string;
  hot: boolean;
  replicas: number;
  /** The store's accent: a shard is painted like the store it belongs to. */
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

const AMBER = "hsl(var(--node-person))";

/**
 * One shard: the card, its range, its copies — the primary filled, the
 * replicas hollow, as many as the store's replication factor says — and its
 * region. A hot shard is painted amber and says so.
 */
const ShardNode = memo(({ data: d, selected }: NodeProps<Node<ShardNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.hot ? AMBER : (d.laneAccent ?? d.defaultAccent));
  const isSelected = !!(selected || d.isSelected);
  const accent = d.hot ? AMBER : palette.accent;

  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS["deploy-shard"]}
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
        className={`flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-lg px-3 py-2 shadow-sm ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        style={{
          background: palette.surface,
          border: `1px ${palette.borderStyle} ${palette.border}`,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <HardDrive size={16} strokeWidth={1.75} color={accent} className="shrink-0" />
          <span
            className="min-w-0 flex-1 select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.name}
          </span>
          {d.hot && (
            <span
              className="flex shrink-0 items-center gap-0.5 rounded px-1 font-mono text-[10px]"
              style={{
                background: `color-mix(in srgb, ${AMBER} 18%, transparent)`,
                color: palette.title,
              }}
            >
              <Flame size={10} strokeWidth={2} color={AMBER} />
              {t("deploy.hot")}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {d.keyRange && <Chip>{d.keyRange}</Chip>}
          {d.region && <Chip>{d.region}</Chip>}
          <span
            className="flex items-center gap-1"
            aria-label={t("deploy.replicas", { count: d.replicas + 1 })}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
            {Array.from({ length: d.replicas }, (_, i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full"
                style={{ border: `1.5px solid ${accent}` }}
              />
            ))}
          </span>
        </div>
      </div>
    </>
  );
});

ShardNode.displayName = "ShardNode";

export default ShardNode;
