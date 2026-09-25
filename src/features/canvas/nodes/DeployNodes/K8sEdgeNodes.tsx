import { memo, type ReactNode } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Globe, Network } from "lucide-react";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { Chip, DeployHandles } from "./DeployParts";

export type K8sEntryNodeData = SkinNodeData & {
  chip?: string;
  detail?: string;
  incomingCount: number;
  outgoingCount: number;
};

function EntryCard({
  d,
  selected,
  icon,
  sizeKey,
}: {
  d: K8sEntryNodeData;
  selected: boolean;
  icon: (color: string) => ReactNode;
  sizeKey: "k8s-service" | "k8s-ingress";
}) {
  const palette = useSkinPalette(d, d.laneAccent ?? FLOW_DEFAULT_ACCENT);
  const isSelected = !!(selected || d.isSelected);
  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS[sizeKey]}
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
        {icon(palette.icon)}
        <div className="min-w-0 flex-1">
          <p
            className="select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.name}
          </p>
          {/* Under the name, so a long chip never squeezes it. */}
          {(d.detail || d.chip) && (
            <div className="flex min-w-0 items-center gap-1.5">
              {d.detail && (
                <span
                  className="min-w-0 select-none truncate text-xs"
                  style={{ color: palette.muted }}
                >
                  {d.detail}
                </span>
              )}
              {d.chip && <Chip>{d.chip}</Chip>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** A Service: network glyph and its type and port, "ClusterIP :8080". */
export const K8sServiceNode = memo(({ data, selected }: NodeProps<Node<K8sEntryNodeData>>) => (
  <EntryCard
    d={data}
    selected={!!selected}
    sizeKey="k8s-service"
    icon={(color) => <Network size={16} strokeWidth={1.75} color={color} className="shrink-0" />}
  />
));
K8sServiceNode.displayName = "K8sServiceNode";

/** An Ingress: globe, its host, and its class. */
export const K8sIngressNode = memo(({ data, selected }: NodeProps<Node<K8sEntryNodeData>>) => (
  <EntryCard
    d={data}
    selected={!!selected}
    sizeKey="k8s-ingress"
    icon={(color) => <Globe size={16} strokeWidth={1.75} color={color} className="shrink-0" />}
  />
));
K8sIngressNode.displayName = "K8sIngressNode";
