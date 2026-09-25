import { Globe, Network } from "lucide-react";
import { K8sIngressNode, K8sServiceNode } from "@/features/canvas/nodes/DeployNodes/K8sEdgeNodes";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import {
  COMPONENT_TYPE_K8S_INGRESS,
  COMPONENT_TYPE_K8S_SERVICE,
} from "@/features/diagram/model/component-type-constants";
import {
  isK8sIngressComponent,
  isK8sServiceComponent,
} from "@/features/diagram/model/component.guards";
import type { K8sServiceComponent } from "@/features/diagram/model/component.types";
import type { ElementDescriptor, ExportGeometry } from "../../../element.types";
import type { ExportNode } from "@/lib/export-core";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../../deploy/deploy.shared";
import {
  K8S_FAMILY_ID,
  K8S_PALETTE_CATEGORY_ID,
  K8sInspector,
  k8sIconStyle,
} from "./k8s-structure.shared";

const ENTRY_W = 200;
const ENTRY_H = 56;
const ICON = 28;

/** "ClusterIP :8080" — the type, and the port when there is one. */
export function serviceChip(service: K8sServiceComponent): string {
  const type = service.serviceType ?? "ClusterIP";
  return service.port !== undefined ? `${type} :${service.port}` : type;
}

function entryStyle(
  comp: Parameters<typeof playbackStyle>[0],
  ctx: Parameters<typeof playbackStyle>[1],
) {
  const layout = ctx.resolvedNodeLayouts[comp.id];
  return {
    width: layout?.width ?? ENTRY_W,
    height: layout?.height ?? ENTRY_H,
    ...playbackStyle(comp, ctx),
  };
}

/** A card with its draw.io Kubernetes glyph on the left, the text beside it. */
function entryExport(
  comp: Parameters<typeof playbackStyle>[0] & { customColor?: string },
  base: ExportGeometry,
  label: string,
  prIcon: string,
): ExportNode {
  return {
    ...base,
    kind: "stencil",
    name: comp.name,
    shapeStyle: `rounded=1;arcSize=8;absoluteArcSize=1;align=left;spacingLeft=${ICON + 14};`,
    label,
    representations: [
      {
        id: `${comp.id}-icon`,
        label: "",
        x: 8,
        y: Math.max(0, Math.round((base.height - ICON) / 2)),
        width: ICON,
        height: ICON,
        shapeStyle: k8sIconStyle(prIcon),
      },
    ],
    ...flowExportColours(comp, FLOW_DEFAULT_ACCENT),
  };
}

/** A Service: what a workload is reached by inside the cluster. */
export const k8sServiceElement: ElementDescriptor = {
  id: COMPONENT_TYPE_K8S_SERVICE,
  family: K8S_FAMILY_ID,
  labelKey: "elements.k8s-service.label",
  descriptionKey: "elements.k8s-service.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_K8S_SERVICE }),
    defaultSize: { width: ENTRY_W, height: ENTRY_H },
    patchableKeys: ["serviceType", "port", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_K8S_SERVICE,
    component: K8sServiceNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isK8sServiceComponent(comp)) return {};
      return { ...deployBuildData(comp, ctx), chip: serviceChip(comp) };
    },

    buildStyle: entryStyle,
  },

  palette: {
    categoryId: K8S_PALETTE_CATEGORY_ID,
    icon: { kind: "lucide", icon: Network },
    accent: { kind: "neutral" },
    searchKeys: ["kubernetes", "k8s", "service", "svc", "clusterip", "loadbalancer", "nodeport"],
  },

  inspector: { panel: K8sInspector },

  skin: { defaultAccent: FLOW_DEFAULT_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isK8sServiceComponent(comp)) {
          throw new Error(`[elements] k8s-service export received a ${comp.type} component.`);
        }
        return entryExport(comp, base, `${comp.name}\n${serviceChip(comp)}`, "svc");
      },
    },
  },
};

/** An Ingress: where traffic enters the cluster, by host. */
export const k8sIngressElement: ElementDescriptor = {
  id: COMPONENT_TYPE_K8S_INGRESS,
  family: K8S_FAMILY_ID,
  labelKey: "elements.k8s-ingress.label",
  descriptionKey: "elements.k8s-ingress.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_K8S_INGRESS }),
    defaultSize: { width: ENTRY_W, height: ENTRY_H },
    patchableKeys: ["host", "ingressClass", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_K8S_INGRESS,
    component: K8sIngressNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isK8sIngressComponent(comp)) return {};
      return { ...deployBuildData(comp, ctx), detail: comp.host, chip: comp.ingressClass };
    },

    buildStyle: entryStyle,
  },

  palette: {
    categoryId: K8S_PALETTE_CATEGORY_ID,
    icon: { kind: "lucide", icon: Globe },
    accent: { kind: "neutral" },
    searchKeys: ["kubernetes", "k8s", "ingress", "ing", "nginx", "traefik", "host"],
  },

  inspector: { panel: K8sInspector },

  skin: { defaultAccent: FLOW_DEFAULT_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isK8sIngressComponent(comp)) {
          throw new Error(`[elements] k8s-ingress export received a ${comp.type} component.`);
        }
        const details = [comp.host, comp.ingressClass].filter(Boolean).join(" · ");
        return entryExport(comp, base, [comp.name, details].filter(Boolean).join("\n"), "ing");
      },
    },
  },
};
