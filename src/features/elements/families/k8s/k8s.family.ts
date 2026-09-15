import CardNode from "@/features/canvas/nodes/CardNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CardNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import {
  cloudServiceIdWrite,
  resolveCloudServiceId,
} from "@/features/diagram/model/cloud-service-id";
import { isK8sComponent } from "@/features/diagram/model/component.guards";
import i18n from "@/infrastructure/i18n";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import {
  K8S_CATEGORIES,
  K8S_SERVICE_MAP,
  asK8sCategoryType,
  isK8sCategoryId,
  type K8sCategoryId,
} from "./k8s.catalog";
import { k8sIconResolver } from "./k8s.icon-resolver";
import { k8sIconDataUri } from "./k8s.export-icons";

function accentFor(categoryId: K8sCategoryId) {
  return { kind: "token" as const, cssVar: `--${categoryId}` };
}

/**
 * Kubernetes as a `CloudFamilyDefinition`.
 *
 * Registered only through `registerCloudFamily` — no cloud/providers stack,
 * no ComponentType / palette / LLM edits. Export uses the F2 image floor
 * (community SVGs); there is no mxgraph.kubernetes kind in this repo.
 */
export const k8sFamily: CloudFamilyDefinition = {
  id: "k8s",
  labelKey: "canvasToolbar.kubernetesServices",
  paletteCategoryId: "k8s",
  primaryCategoryIds: ["k8s-workloads", "k8s-networking", "k8s-storage", "k8s-config"],

  categories: K8S_CATEGORIES.map((category) => ({
    id: asK8sCategoryType(category.id),
    labelKey: `elements.k8s.categories.${category.id}.label`,
    descriptionKey: `elements.k8s.categories.${category.id}.description`,
    accent: accentFor(category.id),
  })),

  services: K8S_CATEGORIES.flatMap((category) =>
    category.services.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      categoryId: asK8sCategoryType(category.id),
    })),
  ),

  icons: k8sIconResolver,

  card: {
    component: CardNode,
    handles: SPREAD_HANDLES,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },

  export: {
    toExportNode: (comp, base) => {
      if (!isK8sComponent(comp)) {
        throw new Error(`[elements] k8s export received a ${comp.type} component.`);
      }
      const cloudService = resolveCloudServiceId(comp);
      const service = cloudService ? K8S_SERVICE_MAP.get(cloudService) : undefined;
      const dataUri = service ? k8sIconDataUri(service.iconName) : null;
      // Same control point as domain writes — projects onto ExportNode only.
      const cloudServiceIdField = cloudServiceIdWrite(cloudService);

      if (dataUri) {
        return {
          ...base,
          kind: "image",
          name: comp.name,
          dataUri,
          preserveAspect: true,
          ...cloudServiceIdField,
        };
      }

      return {
        ...base,
        kind: "passthrough",
        name: comp.name,
        description: service?.name ?? comp.technology,
        originType: comp.type,
        originLabel: i18n.t("canvasToolbar.kubernetesServices"),
        ...cloudServiceIdField,
      };
    },
  },

  defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
  patchableKeys: ["cloudServiceId", "technology", "customColor"],

  attachService: (base, categoryId, serviceId) => {
    if (!isK8sCategoryId(categoryId)) {
      throw new Error(
        `[elements] k8s attachService got categoryId "${categoryId}"; expected a k8s-* id.`,
      );
    }
    return {
      ...base,
      type: categoryId,
      ...cloudServiceIdWrite(serviceId),
    };
  },
};

/** Descriptors produced by the family — one per K8s category. */
export const k8sElements = buildCloudFamilyDescriptors(k8sFamily);
