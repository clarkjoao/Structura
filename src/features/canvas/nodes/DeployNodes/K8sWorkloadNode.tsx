import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { K8sWorkloadKind } from "@/features/diagram/model/component.types";
import type { ReplicaTile } from "@/features/diagram/utils/k8s-workload";
import { mix } from "../ProcessNode/flowAppearance";
import { useSkinPalette, type SkinNodeData } from "../skin/skin";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { Chip, DeployHandles } from "./DeployParts";

export type K8sWorkloadNodeData = SkinNodeData & {
  kind: K8sWorkloadKind;
  replicas: number;
  stacked: boolean;
  tiles: ReplicaTile[];
  moreTiles: number;
  hpaMin?: number;
  hpaMax?: number;
  image?: string;
  resources?: string;
  schedule?: string;
  concurrencyPolicy?: string;
  collapsed: boolean;
  /** Init containers, said as "init ×N" on the compact card. */
  initCount: number;
  /** In a namespace whose mesh injects a sidecar: badged, no container drawn. */
  meshed: boolean;
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

/** A pod tile; a StatefulSet's carries its claim as a small cylinder. */
function Tile({ tile, accent }: { tile: ReplicaTile; accent: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] leading-tight"
      style={{ background: mix(accent, 14, "transparent"), color: "hsl(var(--foreground))" }}
    >
      {tile.label}
      {tile.volume && (
        <svg width="9" height="11" viewBox="0 0 9 11" aria-label={tile.volume}>
          <ellipse cx="4.5" cy="2" rx="3.8" ry="1.6" fill="none" stroke={accent} strokeWidth="1" />
          <path d="M0.7 2 V9 A3.8 1.6 0 0 0 8.3 9 V2" fill="none" stroke={accent} strokeWidth="1" />
        </svg>
      )}
    </span>
  );
}

/**
 * A workload: the card, its kind, its replica count and autoscaling on the
 * right, image and resources below, and its pods as tiles — representations
 * of its data, not nodes. More than one replica stacks two shadow cards
 * behind it.
 */
const K8sWorkloadNode = memo(({ data: d, selected }: NodeProps<Node<K8sWorkloadNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  const isSelected = !!(selected || d.isSelected);
  const accent = palette.accent;
  const card = {
    background: palette.surface,
    border: `1px ${palette.borderStyle} ${palette.border}`,
  };

  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS["k8s-workload"]}
        isVisible={isSelected && !d.collapsed}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
      />
      {d.stacked &&
        [12, 6].map((offset) => (
          <div
            key={offset}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg shadow-sm"
            style={{ ...card, transform: `translate(${offset}px, ${offset}px)` }}
          />
        ))}
      <div
        className={`relative flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-lg px-3 py-2 shadow-sm ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        style={{ ...card, borderLeft: `3px solid ${accent}` }}
      >
        {d.meshed && (
          <span
            className="absolute right-2 top-1 select-none rounded-full px-1.5 font-mono text-[10px] leading-4"
            style={{
              border: "1px solid hsl(var(--node-system))",
              color: "hsl(var(--node-system))",
              background: "hsl(var(--card))",
            }}
          >
            mesh
          </span>
        )}
        <div className={`flex min-w-0 items-center gap-2 ${d.meshed ? "pr-11" : ""}`}>
          <Box size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />
          <span
            className="min-w-0 flex-1 select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.name}
          </span>
          {d.kind !== "Pod" && d.kind !== "CronJob" && d.kind !== "Job" && (
            <span
              className="shrink-0 select-none font-mono text-[11px]"
              style={{ color: palette.muted }}
            >
              ×{d.replicas}
            </span>
          )}
        </div>
        {/* The name keeps the first row; kind, autoscaling, image and resources wrap below it. */}
        <div className="flex min-w-0 flex-wrap gap-1">
          <Chip>{d.kind}</Chip>
          {d.hpaMin !== undefined && d.hpaMax !== undefined && (
            <Chip>
              HPA {d.hpaMin}–{d.hpaMax}
            </Chip>
          )}
          {d.image && <Chip>{d.image}</Chip>}
          {d.resources && <Chip>{d.resources}</Chip>}
          {d.collapsed && d.initCount > 0 && <Chip>init ×{d.initCount}</Chip>}
        </div>
        {d.kind === "CronJob" ? (
          <div className="flex min-w-0 flex-wrap gap-1">
            {d.schedule && <Chip>{d.schedule}</Chip>}
            {d.concurrencyPolicy && <Chip>{d.concurrencyPolicy}</Chip>}
          </div>
        ) : d.tiles.length > 0 ? (
          <div className="min-w-0">
            <p
              className="select-none text-[11px] font-semibold uppercase"
              style={{ color: palette.muted }}
            >
              {t("k8s.replicas")}
              {d.kind === "DaemonSet" && ` · ${t("k8s.onePerNode")}`}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {d.tiles.map((tile, index) => (
                <Tile key={`${tile.label}-${index}`} tile={tile} accent={accent} />
              ))}
              {d.moreTiles > 0 && (
                <span className="font-mono text-[10px]" style={{ color: palette.muted }}>
                  +{d.moreTiles}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
});

K8sWorkloadNode.displayName = "K8sWorkloadNode";

export default K8sWorkloadNode;
