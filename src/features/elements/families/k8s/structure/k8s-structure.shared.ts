import { createElement } from "react";
import SkinnedElementPanel from "@/features/canvas/panels/ElementPanel/SkinnedElementPanel";
import type { ElementInspectorProps } from "../../../element.types";

/**
 * Kubernetes as structure — cluster, namespace, workload, service, ingress —
 * beside the catalog family's service cards. Same family id (`k8s`) and the
 * same picker tab; these are typed containers and their contents, drawn with
 * the flow skin.
 */
export const K8S_FAMILY_ID = "k8s";
export const K8S_PALETTE_CATEGORY_ID = "k8s";

/** Purple, the container token — what the cluster, namespaces and workloads are painted in. */
export const K8S_ACCENT = "hsl(var(--node-container))";

/** Compact, a cluster or namespace is its header: name and chips. Derived, never stored. */
export const K8S_FRAME_COMPACT_H = 64;

/** Where a container's header glyph sits in the export, and how far its title moves over. */
export const EXPORT_ICON = { x: 8, y: 6, size: 20 } as const;
export const EXPORT_TITLE_INDENT = "spacingLeft=34;";

/** draw.io's `mxgraph.kubernetes.icon2` glyph, by its `prIcon` (from mxKubernetes.js). */
export function k8sIconStyle(prIcon: string): string {
  return `shape=mxgraph.kubernetes.icon2;prIcon=${prIcon};`;
}

export function K8sInspector(props: ElementInspectorProps) {
  return createElement(SkinnedElementPanel, props);
}
