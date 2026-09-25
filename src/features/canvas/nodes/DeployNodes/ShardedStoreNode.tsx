import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ShardStrategy } from "@/features/diagram/model/component.types";
import type { KeySpaceSegment } from "@/features/diagram/utils/sharded-store";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { mix } from "../ProcessNode/flowAppearance";
import { Chip, DeployHandles } from "./DeployParts";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";

export type ShardedStoreNodeData = SkinNodeData & {
  strategy: ShardStrategy;
  keyExpression?: string;
  technology?: string;
  replicationFactor: number;
  collapsed: boolean;
  shardCount: number;
  segments: KeySpaceSegment[];
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

const AMBER = "hsl(var(--node-person))";
const RING = 72;

/** The key-space bar: one segment per shard, sized by the strategy. A representation, not nodes. */
function KeyBar({
  segments,
  accent,
  height,
  showLabels,
}: {
  segments: KeySpaceSegment[];
  accent: string;
  height: number;
  showLabels: boolean;
}) {
  return (
    <div className="flex w-full" style={{ height, gap: 3 }} aria-hidden>
      {segments.map((segment) => (
        <div
          key={segment.shardId}
          className="flex min-w-0 items-center justify-center overflow-hidden rounded-sm"
          style={{
            flexGrow: segment.share,
            flexBasis: 0,
            background: mix(
              segment.hot ? AMBER : accent,
              segment.emphasis === "light" ? 16 : 28,
              "transparent",
            ),
          }}
        >
          {showLabels && (
            <span
              className="truncate px-1 font-mono text-[10px]"
              style={{ color: "hsl(var(--foreground))" }}
            >
              {segment.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Consistent hashing: the same fractions drawn as arcs of a ring. */
function KeyRing({ segments, accent }: { segments: KeySpaceSegment[]; accent: string }) {
  const r = RING / 2 - 6;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg
      width={RING}
      height={RING}
      viewBox={`0 0 ${RING} ${RING}`}
      aria-hidden
      className="shrink-0"
    >
      {segments.map((segment) => {
        const length = Math.max(0, segment.share * c - 3);
        const circle = (
          <circle
            key={segment.shardId}
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke={mix(
              segment.hot ? AMBER : accent,
              segment.emphasis === "light" ? 45 : 80,
              "transparent",
            )}
            strokeWidth={10}
            strokeDasharray={`${length} ${c - length}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        );
        offset += segment.share * c;
        return circle;
      })}
    </svg>
  );
}

/**
 * A sharded store: a typed container. The header carries what an architect
 * asks first — engine, key, shard count (derived) and replication — and the
 * key-space bar shows how the keys are spread. Its shards and router are its
 * children, drawn below. Compact, it is the header, the chips and a 6px bar.
 */
const ShardedStoreNode = memo(({ data: d, selected }: NodeProps<Node<ShardedStoreNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  const isSelected = !!(selected || d.isSelected);
  const accent = palette.accent;

  const chips = (
    <div className="flex min-w-0 flex-wrap gap-1">
      {d.technology && <Chip>{d.technology}</Chip>}
      {d.keyExpression && <Chip>{d.keyExpression}</Chip>}
      <Chip>
        {t(`deploy.strategy.${d.strategy}`)} · {t("deploy.shards", { count: d.shardCount })}
      </Chip>
      <Chip>RF {d.replicationFactor}</Chip>
    </div>
  );

  return (
    <>
      <NodeResizer
        minWidth={ELEMENT_SIZE_LIMITS["deploy-sharded-store"].minWidth}
        minHeight={d.collapsed ? 84 : 160}
        isVisible={isSelected && !d.collapsed}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
      />
      <div
        className={`flex h-full w-full flex-col gap-2 overflow-hidden rounded-xl px-3 py-2.5 ${
          d.collapsed ? "shadow-sm" : ""
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
        style={{
          background: d.collapsed ? palette.surface : mix(accent, 4),
          border: `1.5px ${palette.borderStyle} ${mix(accent, 40, "transparent")}`,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <div className="flex min-w-0 items-start gap-2">
          <Database size={16} strokeWidth={1.75} color={palette.icon} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p
              className="select-none truncate text-sm font-semibold"
              style={{ color: palette.title }}
            >
              {d.name}
            </p>
            {d.description && !d.collapsed && (
              <p className="select-none truncate text-xs" style={{ color: palette.muted }}>
                {d.description}
              </p>
            )}
          </div>
          {d.strategy === "consistent-hash" && !d.collapsed && (
            <KeyRing segments={d.segments} accent={accent} />
          )}
        </div>
        {chips}
        {d.strategy !== "consistent-hash" || d.collapsed ? (
          <KeyBar
            segments={d.segments}
            accent={accent}
            height={d.collapsed ? 6 : 26}
            showLabels={!d.collapsed}
          />
        ) : null}
      </div>
    </>
  );
});

ShardedStoreNode.displayName = "ShardedStoreNode";

export default ShardedStoreNode;
