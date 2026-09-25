import { Box } from "lucide-react";
import K8sWorkloadNode from "@/features/canvas/nodes/DeployNodes/K8sWorkloadNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import { COMPONENT_TYPE_K8S_WORKLOAD } from "@/features/diagram/model/component-type-constants";
import { isK8sWorkloadComponent } from "@/features/diagram/model/component.guards";
import type { K8sWorkloadKind } from "@/features/diagram/model/component.types";
import {
  isStacked,
  replicaCount,
  replicaTiles,
  workloadKind,
} from "@/features/diagram/utils/k8s-workload";
import type { ElementDescriptor } from "../../../element.types";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../../deploy/deploy.shared";
import {
  EXPORT_ICON,
  EXPORT_TITLE_INDENT,
  K8S_ACCENT,
  K8S_FAMILY_ID,
  K8S_PALETTE_CATEGORY_ID,
  K8sInspector,
  k8sIconStyle,
} from "./k8s-structure.shared";

const WORKLOAD_W = 240;
const WORKLOAD_H = 120;
/** Where the pod tiles start in the exported card, and how big each is. */
const TILE = { y: 64, width: 52, height: 18, gap: 4 } as const;

/** The `mxgraph.kubernetes.icon2` glyph of each kind. */
export const WORKLOAD_PR_ICON: Readonly<Record<K8sWorkloadKind, string>> = {
  Deployment: "deploy",
  StatefulSet: "sts",
  DaemonSet: "ds",
  Job: "job",
  CronJob: "cronjob",
  Pod: "pod",
};

/** Kinds whose card shows ×N: the ones that keep a set of replicas running. */
function showsReplicaCount(kind: K8sWorkloadKind): boolean {
  return kind === "Deployment" || kind === "StatefulSet" || kind === "DaemonSet";
}

/**
 * A workload. Its pods are tiles drawn from its data, not nodes; more than
 * one replica stacks the card.
 */
export const k8sWorkloadElement: ElementDescriptor = {
  id: COMPONENT_TYPE_K8S_WORKLOAD,
  family: K8S_FAMILY_ID,
  labelKey: "elements.k8s-workload.label",
  descriptionKey: "elements.k8s-workload.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_K8S_WORKLOAD }),
    defaultSize: { width: WORKLOAD_W, height: WORKLOAD_H },
    patchableKeys: [
      "kind",
      "replicas",
      "hpaMin",
      "hpaMax",
      "image",
      "resources",
      "zones",
      "schedule",
      "concurrencyPolicy",
      ...skinPatchableKeys,
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_K8S_WORKLOAD,
    component: K8sWorkloadNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isK8sWorkloadComponent(comp)) return {};
      const kind = workloadKind(comp);
      const { tiles, more } = replicaTiles(comp, ctx.resolvedComponents);
      return {
        ...deployBuildData(comp, ctx),
        kind,
        replicas: replicaCount(comp, ctx.resolvedComponents),
        stacked: isStacked(comp, ctx.resolvedComponents),
        tiles,
        moreTiles: more,
        hpaMin: comp.hpaMin,
        hpaMax: comp.hpaMax,
        image: comp.image,
        resources: comp.resources,
        schedule: comp.schedule,
        concurrencyPolicy: comp.concurrencyPolicy,
        defaultAccent: K8S_ACCENT,
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? WORKLOAD_W,
        height: layout?.height ?? WORKLOAD_H,
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: K8S_PALETTE_CATEGORY_ID,
    icon: { kind: "lucide", icon: Box },
    accent: { kind: "token", cssVar: "--node-container" },
    searchKeys: [
      "kubernetes",
      "k8s",
      "workload",
      "deployment",
      "statefulset",
      "daemonset",
      "job",
      "cronjob",
      "pod",
    ],
  },

  inspector: { panel: K8sInspector },

  skin: { defaultAccent: K8S_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base, context) => {
        if (!isK8sWorkloadComponent(comp)) {
          throw new Error(`[elements] k8s-workload export received a ${comp.type} component.`);
        }
        const components = context?.components ?? { [comp.id]: comp };
        const kind = workloadKind(comp);
        const count = replicaCount(comp, components);
        const header = [
          kind,
          showsReplicaCount(kind) ? `×${count}` : "",
          comp.hpaMin !== undefined && comp.hpaMax !== undefined
            ? `HPA ${comp.hpaMin}–${comp.hpaMax}`
            : "",
        ].filter(Boolean);
        const details =
          kind === "CronJob"
            ? [comp.schedule, comp.concurrencyPolicy]
            : [comp.image, comp.resources];
        const { tiles, more } = replicaTiles(comp, components);
        const tileCells = [
          ...tiles.map((tile) => (tile.volume ? `${tile.label} · ${tile.volume}` : tile.label)),
          ...(more > 0 ? [`+${more}`] : []),
        ].map((label, index) => ({
          id: `${comp.id}-pod-${index}`,
          label,
          x: 10 + index * (TILE.width + TILE.gap),
          y: TILE.y,
          width: TILE.width,
          height: TILE.height,
          fillOpacity: 14,
        }));
        return {
          ...base,
          kind: "container",
          name: comp.name,
          label: [`${comp.name} · ${header.join(" · ")}`, details.filter(Boolean).join(" · ")]
            .filter(Boolean)
            .join("\n"),
          extraStyle: EXPORT_TITLE_INDENT,
          stacked: isStacked(comp, components),
          representations: [
            {
              id: `${comp.id}-icon`,
              label: "",
              x: EXPORT_ICON.x,
              y: EXPORT_ICON.y,
              width: EXPORT_ICON.size,
              height: EXPORT_ICON.size,
              shapeStyle: k8sIconStyle(WORKLOAD_PR_ICON[kind]),
            },
            ...tileCells,
          ],
          ...flowExportColours(comp, K8S_ACCENT),
        };
      },
    },
  },
};
