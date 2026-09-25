import { Boxes, SquareDashed } from "lucide-react";
import {
  K8sClusterNode,
  K8sNamespaceNode,
} from "@/features/canvas/nodes/DeployNodes/K8sClusterNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import {
  COMPONENT_TYPE_K8S_CLUSTER,
  COMPONENT_TYPE_K8S_INGRESS,
  COMPONENT_TYPE_K8S_NAMESPACE,
  COMPONENT_TYPE_K8S_SERVICE,
  COMPONENT_TYPE_K8S_WORKLOAD,
} from "@/features/diagram/model/component-type-constants";
import {
  isK8sClusterComponent,
  isK8sNamespaceComponent,
} from "@/features/diagram/model/component.guards";
import type {
  K8sClusterComponent,
  K8sNamespaceComponent,
} from "@/features/diagram/model/component.types";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor } from "../../../element.types";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../../deploy/deploy.shared";
import {
  EXPORT_ICON,
  EXPORT_TITLE_INDENT,
  K8S_ACCENT,
  K8S_FAMILY_ID,
  K8S_FRAME_COMPACT_H,
  K8S_PALETTE_CATEGORY_ID,
  K8sInspector,
  k8sIconStyle,
} from "./k8s-structure.shared";

const CLUSTER_W = 720;
const CLUSTER_H = 440;
const NAMESPACE_W = 560;
const NAMESPACE_H = 300;

const IN_NAMESPACE = [
  COMPONENT_TYPE_K8S_WORKLOAD,
  COMPONENT_TYPE_K8S_SERVICE,
  COMPONENT_TYPE_K8S_INGRESS,
] as const;

function frameStyle(
  comp: K8sClusterComponent | K8sNamespaceComponent,
  ctx: NodeBuildContext,
  width: number,
  height: number,
) {
  const layout = ctx.resolvedNodeLayouts[comp.id];
  return {
    width: layout?.width ?? width,
    height: comp.collapsed === true ? K8S_FRAME_COMPACT_H : (layout?.height ?? height),
    ...playbackStyle(comp, ctx),
  };
}

/** A Kubernetes cluster: namespaces, and workloads, services and ingresses straight in it. */
export const k8sClusterElement: ElementDescriptor = {
  id: COMPONENT_TYPE_K8S_CLUSTER,
  family: K8S_FAMILY_ID,
  labelKey: "elements.k8s-cluster.label",
  descriptionKey: "elements.k8s-cluster.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_K8S_CLUSTER }),
    defaultSize: { width: CLUSTER_W, height: CLUSTER_H },
    defaultZIndex: -1,
    patchableKeys: [
      "distribution",
      "version",
      "nodeCount",
      "zoneCount",
      "collapsed",
      ...skinPatchableKeys,
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_K8S_CLUSTER,
    component: K8sClusterNode,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    connectable: true,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    derivesSize: true,
    acceptsChildren: [COMPONENT_TYPE_K8S_NAMESPACE, ...IN_NAMESPACE],
    collapsible: true,

    buildData: (comp, ctx) => {
      if (!isK8sClusterComponent(comp)) return {};
      return {
        ...deployBuildData(comp, ctx),
        collapsed: comp.collapsed === true,
        distribution: comp.distribution,
        version: comp.version,
        nodeCount: comp.nodeCount,
        zoneCount: comp.zoneCount,
        defaultAccent: K8S_ACCENT,
      };
    },

    buildStyle: (comp, ctx) =>
      isK8sClusterComponent(comp) ? frameStyle(comp, ctx, CLUSTER_W, CLUSTER_H) : undefined,
  },

  palette: {
    categoryId: K8S_PALETTE_CATEGORY_ID,
    icon: { kind: "lucide", icon: Boxes },
    accent: { kind: "token", cssVar: "--node-container" },
    searchKeys: ["kubernetes", "k8s", "cluster", "eks", "gke", "aks", "k3s"],
  },

  inspector: { panel: K8sInspector },

  skin: { defaultAccent: K8S_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isK8sClusterComponent(comp)) {
          throw new Error(`[elements] k8s-cluster export received a ${comp.type} component.`);
        }
        const en = { lng: "en" };
        const chips = [
          [comp.distribution, comp.version].filter(Boolean).join(" "),
          comp.nodeCount !== undefined ? i18n.t("k8s.nodes", { ...en, count: comp.nodeCount }) : "",
          comp.zoneCount !== undefined ? i18n.t("k8s.zones", { ...en, count: comp.zoneCount }) : "",
        ].filter(Boolean);
        return {
          ...base,
          kind: "container",
          name: comp.name,
          label: [comp.name, chips.join(" · ")].filter(Boolean).join("\n"),
          ...(comp.collapsed === true
            ? { compact: { width: base.width, height: K8S_FRAME_COMPACT_H } }
            : {}),
          ...flowExportColours(comp, K8S_ACCENT),
        };
      },
    },
  },
};

/** A namespace: dashed, holding workloads, services and ingresses. */
export const k8sNamespaceElement: ElementDescriptor = {
  id: COMPONENT_TYPE_K8S_NAMESPACE,
  family: K8S_FAMILY_ID,
  labelKey: "elements.k8s-namespace.label",
  descriptionKey: "elements.k8s-namespace.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_K8S_NAMESPACE }),
    defaultSize: { width: NAMESPACE_W, height: NAMESPACE_H },
    defaultZIndex: -1,
    patchableKeys: ["meshInjection", "collapsed", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_K8S_NAMESPACE,
    component: K8sNamespaceNode,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    connectable: true,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    derivesSize: true,
    acceptsChildren: IN_NAMESPACE,
    collapsible: true,

    buildData: (comp, ctx) => {
      if (!isK8sNamespaceComponent(comp)) return {};
      return {
        ...deployBuildData(comp, ctx),
        collapsed: comp.collapsed === true,
        meshInjection: comp.meshInjection === true,
        defaultAccent: K8S_ACCENT,
      };
    },

    buildStyle: (comp, ctx) =>
      isK8sNamespaceComponent(comp) ? frameStyle(comp, ctx, NAMESPACE_W, NAMESPACE_H) : undefined,
  },

  palette: {
    categoryId: K8S_PALETTE_CATEGORY_ID,
    icon: { kind: "lucide", icon: SquareDashed },
    accent: { kind: "token", cssVar: "--node-container" },
    searchKeys: ["kubernetes", "k8s", "namespace", "ns", "istio", "mesh"],
  },

  inspector: { panel: K8sInspector },

  skin: { defaultAccent: K8S_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isK8sNamespaceComponent(comp)) {
          throw new Error(`[elements] k8s-namespace export received a ${comp.type} component.`);
        }
        const mesh = comp.meshInjection === true ? i18n.t("k8s.meshInjected", { lng: "en" }) : "";
        const colours = flowExportColours(comp, K8S_ACCENT);
        return {
          ...base,
          kind: "container",
          name: comp.name,
          label: [comp.name, mesh].filter(Boolean).join("\n"),
          extraStyle: EXPORT_TITLE_INDENT,
          ...(comp.collapsed === true
            ? { compact: { width: base.width, height: K8S_FRAME_COMPACT_H } }
            : {}),
          representations: [
            {
              id: `${comp.id}-icon`,
              label: "",
              x: EXPORT_ICON.x,
              y: EXPORT_ICON.y,
              width: EXPORT_ICON.size,
              height: EXPORT_ICON.size,
              shapeStyle: k8sIconStyle("ns"),
            },
          ],
          ...colours,
          // A namespace is a logical grouping: always dashed, as on the canvas.
          dashed: true,
        };
      },
    },
  },
};
