import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { useSkinPalette, type SkinNodeData } from "../skin/skin";
import { Chip } from "./DeployParts";
import { HelmGlyph, K8sFrame, NamespaceGlyph } from "./K8sParts";

export type K8sFrameNodeData = SkinNodeData & {
  collapsed: boolean;
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
  distribution?: string;
  version?: string;
  nodeCount?: number;
  zoneCount?: number;
  meshInjection?: boolean;
};

/** A cluster: helm glyph, name, and the chips — distribution and version, nodes, zones. */
export const K8sClusterNode = memo(({ data: d, selected }: NodeProps<Node<K8sFrameNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  const distro = [d.distribution, d.version].filter(Boolean).join(" ");
  return (
    <K8sFrame
      palette={palette}
      icon={<HelmGlyph color={palette.icon} />}
      name={d.name}
      caption={t("k8s.cluster")}
      chips={
        <>
          {distro && <Chip>{distro}</Chip>}
          {d.nodeCount !== undefined && <Chip>{t("k8s.nodes", { count: d.nodeCount })}</Chip>}
          {d.zoneCount !== undefined && <Chip>{t("k8s.zones", { count: d.zoneCount })}</Chip>}
        </>
      }
      dashed={false}
      collapsed={d.collapsed}
      isSelected={!!(selected || d.isSelected)}
      elementId={d.elementId}
      incomingCount={d.incomingCount}
      outgoingCount={d.outgoingCount}
      minWidth={280}
    />
  );
});
K8sClusterNode.displayName = "K8sClusterNode";

/** A namespace: dashed, with the mesh chip when sidecars are injected into it. */
export const K8sNamespaceNode = memo(({ data: d, selected }: NodeProps<Node<K8sFrameNodeData>>) => {
  const { t } = useTranslation();
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  return (
    <K8sFrame
      palette={palette}
      icon={<NamespaceGlyph color={palette.icon} />}
      name={d.name}
      caption={t("k8s.namespace")}
      chips={
        d.meshInjection ? (
          <Chip tone="color-mix(in srgb, hsl(var(--node-system)) 14%, transparent)">
            {t("k8s.meshInjected")}
          </Chip>
        ) : null
      }
      dashed
      collapsed={d.collapsed}
      isSelected={!!(selected || d.isSelected)}
      elementId={d.elementId}
      incomingCount={d.incomingCount}
      outgoingCount={d.outgoingCount}
      minWidth={240}
    />
  );
});
K8sNamespaceNode.displayName = "K8sNamespaceNode";
