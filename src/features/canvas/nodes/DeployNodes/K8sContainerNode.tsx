import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Container } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { K8sContainerRole } from "@/features/diagram/model/component.types";
import { useSkinPalette, type SkinNodeData } from "../skin/skin";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { Chip, DeployHandles } from "./DeployParts";

export type K8sContainerNodeData = SkinNodeData & {
  podRole: K8sContainerRole;
  purpose?: string;
  order?: number;
  image?: string;
  ports?: number[];
  resources?: string;
  /** On a compact workload a sidecar is drawn as a tab on its right edge. */
  asTab: boolean;
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

/** A sidecar as a tab: 24px, 2px accent on the left, right corners rounded, mono 11. */
function ContainerTab({
  d,
  accent,
  selected,
}: {
  d: K8sContainerNodeData;
  accent: string;
  selected: boolean;
}) {
  return (
    <>
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
      />
      <div
        className={`flex h-full w-full items-center overflow-hidden rounded-r-md px-2 shadow-sm ${
          selected ? "ring-2 ring-primary" : ""
        }`}
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderLeft: `2px solid ${accent}`,
        }}
        title={d.name}
      >
        <span className="min-w-0 select-none truncate font-mono text-[11px] text-foreground">
          {d.name}
        </span>
      </div>
    </>
  );
}

/**
 * A container of a pod: the main one in the workload's purple, a sidecar in
 * teal with its function, an init dashed with its place in the run order.
 */
const K8sContainerNode = memo(({ data: d, selected }: NodeProps<Node<K8sContainerNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  const isSelected = !!(selected || d.isSelected);
  if (d.asTab) return <ContainerTab d={d} accent={palette.accent} selected={isSelected} />;

  const caption =
    d.podRole === "sidecar"
      ? d.purpose
        ? `${t("k8s.role.sidecar")} · ${d.purpose}`
        : t("k8s.role.sidecar")
      : t(`k8s.role.${d.podRole}`);
  const dashed = d.podRole === "init" || palette.borderStyle === "dashed";
  const chips = [
    d.image,
    d.ports && d.ports.length > 0 ? d.ports.map((port) => `:${port}`).join(" ") : undefined,
    d.resources,
  ].filter(Boolean);

  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS["k8s-container"]}
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
        className={`flex h-full w-full flex-col gap-1 overflow-hidden rounded-lg px-3 py-2 shadow-sm ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        style={{
          background: palette.surface,
          border: `1px ${dashed ? "dashed" : "solid"} ${palette.border}`,
          borderLeft: `3px ${dashed ? "dashed" : "solid"} ${palette.accent}`,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {d.podRole === "init" && d.order !== undefined ? (
            <span
              className="flex h-4 w-4 shrink-0 select-none items-center justify-center rounded-full font-mono text-[10px] font-semibold"
              style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}
            >
              {d.order}
            </span>
          ) : (
            <Container size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />
          )}
          <span
            className="min-w-0 flex-1 select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.name}
          </span>
        </div>
        <span className="select-none truncate text-xs" style={{ color: palette.muted }}>
          {caption}
        </span>
        {chips.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-1">
            {chips.map((chip) => (
              <Chip key={chip}>{chip}</Chip>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

K8sContainerNode.displayName = "K8sContainerNode";

export default K8sContainerNode;
