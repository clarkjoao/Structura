import { Container } from "lucide-react";
import K8sContainerNode from "@/features/canvas/nodes/DeployNodes/K8sContainerNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import { COMPONENT_TYPE_K8S_CONTAINER } from "@/features/diagram/model/component-type-constants";
import { isK8sContainerComponent } from "@/features/diagram/model/component.guards";
import type {
  Component,
  K8sContainerComponent,
  K8sContainerRole,
} from "@/features/diagram/model/component.types";
import { containerRole } from "@/features/diagram/utils/k8s-pod";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor } from "../../../element.types";
import { isShownAsTab } from "../../../containment";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../../deploy/deploy.shared";
import {
  K8S_ACCENT,
  K8S_FAMILY_ID,
  K8S_PALETTE_CATEGORY_ID,
  K8sInspector,
} from "./k8s-structure.shared";

const CONTAINER_W = 180;
/** Name, role and a row of chips. */
const CONTAINER_H = 88;

/** Teal, the system token: what rides alongside the main container. */
export const K8S_SIDECAR_ACCENT = "hsl(var(--node-system))";

/** Each role's default accent: main in the workload's purple, a sidecar teal, an init neutral. */
export function containerAccent(role: K8sContainerRole): string {
  return role === "sidecar"
    ? K8S_SIDECAR_ACCENT
    : role === "init"
      ? "hsl(var(--muted-foreground))"
      : K8S_ACCENT;
}

function isSidecar(component: Component): boolean {
  return isK8sContainerComponent(component) && containerRole(component) === "sidecar";
}

/** "sidecar · proxy", "main", "init" — in English, for the export. */
export function containerCaption(container: K8sContainerComponent): string {
  const role = containerRole(container);
  const word = i18n.t(`k8s.role.${role}`, { lng: "en" });
  return role === "sidecar" && container.purpose ? `${word} · ${container.purpose}` : word;
}

/** A container of a workload's pod template. Only a workload takes it. */
export const k8sContainerElement: ElementDescriptor = {
  id: COMPONENT_TYPE_K8S_CONTAINER,
  family: K8S_FAMILY_ID,
  labelKey: "elements.k8s-container.label",
  descriptionKey: "elements.k8s-container.description",

  model: {
    createComponent: (base, options) => ({
      ...base,
      type: COMPONENT_TYPE_K8S_CONTAINER,
      ...(options.podRole && options.podRole !== "main" ? { podRole: options.podRole } : {}),
      ...(options.order !== undefined ? { order: options.order } : {}),
    }),
    defaultSize: { width: CONTAINER_W, height: CONTAINER_H },
    patchableKeys: [
      "podRole",
      "purpose",
      "order",
      "image",
      "ports",
      "resources",
      ...skinPatchableKeys,
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_K8S_CONTAINER,
    component: K8sContainerNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,
    // A sidecar stays reachable on a compact workload, as a tab.
    tabOnCompactParent: isSidecar,

    buildData: (comp, ctx) => {
      if (!isK8sContainerComponent(comp)) return {};
      const role = containerRole(comp);
      return {
        ...deployBuildData(comp, ctx),
        podRole: role,
        purpose: comp.purpose,
        order: comp.order,
        image: comp.image,
        ports: comp.ports,
        resources: comp.resources,
        asTab: isShownAsTab(comp, ctx.resolvedComponents),
        defaultAccent: containerAccent(role),
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? CONTAINER_W,
        height: layout?.height ?? CONTAINER_H,
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: K8S_PALETTE_CATEGORY_ID,
    icon: { kind: "lucide", icon: Container },
    accent: { kind: "token", cssVar: "--node-system" },
    searchKeys: ["kubernetes", "k8s", "container", "sidecar", "init", "envoy", "istio-proxy"],
    variants: (["main", "sidecar", "init"] as const).map((role) => ({
      id: role,
      labelKey: `k8s.variant.${role}`,
      icon: { kind: "lucide" as const, icon: Container },
      createOptions: role === "main" ? {} : { podRole: role },
      searchKeys: ["kubernetes", "k8s", "container", role],
    })),
  },

  inspector: { panel: K8sInspector },

  skin: {
    defaultAccent: K8S_ACCENT,
    // The accent a container falls back to depends on its role.
    defaultAccentOf: (comp) =>
      containerAccent(isK8sContainerComponent(comp) ? containerRole(comp) : "main"),
  },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isK8sContainerComponent(comp)) {
          throw new Error(`[elements] k8s-container export received a ${comp.type} component.`);
        }
        const role = containerRole(comp);
        const details = [
          comp.image,
          comp.ports && comp.ports.length > 0 ? comp.ports.map((p) => `:${p}`).join(" ") : "",
          comp.resources,
        ].filter(Boolean);
        const title =
          role === "init" && comp.order !== undefined ? `${comp.order}. ${comp.name}` : comp.name;
        const colours = flowExportColours(comp, containerAccent(role));
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle: "rounded=1;arcSize=8;absoluteArcSize=1;align=left;spacingLeft=10;",
          label: [title, containerCaption(comp), details.join(" · ")].filter(Boolean).join("\n"),
          ...colours,
          // An init container is drawn dashed, as on the canvas.
          dashed: colours.dashed || role === "init",
        };
      },
    },
  },
};
