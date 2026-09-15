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
import type { Component } from "@/features/diagram/model/component.types";
import i18n from "@/infrastructure/i18n";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import {
  OSS_CATEGORIES,
  OSS_SERVICE_MAP,
  asOssCategoryType,
  isOssCategoryId,
  type OssCategoryId,
} from "./oss.catalog";
import { ossIconResolver } from "./oss.icon-resolver";
import { ossIconDataUri } from "./oss.export-icons";

function accentFor(categoryId: OssCategoryId) {
  return { kind: "token" as const, cssVar: `--${categoryId}` };
}

/**
 * Open-source technologies as a flat `CloudFamilyDefinition`.
 *
 * Same contract as K8s/GCP — categories are descriptors, services are variants.
 * The catalog is small on purpose; add RabbitMQ/Elasticsearch later as services
 * under existing natures rather than new families.
 */
export const ossFamily: CloudFamilyDefinition = {
  id: "oss",
  labelKey: "canvasToolbar.ossServices",
  paletteCategoryId: "oss",
  primaryCategoryIds: ["oss-datastore", "oss-messaging"],

  categories: OSS_CATEGORIES.map((category) => ({
    id: asOssCategoryType(category.id),
    labelKey: `elements.oss.categories.${category.id}.label`,
    descriptionKey: `elements.oss.categories.${category.id}.description`,
    accent: accentFor(category.id),
  })),

  services: OSS_CATEGORIES.flatMap((category) =>
    category.services.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      categoryId: asOssCategoryType(category.id),
      // Per-service line for the LLM catalog. The hyperscaler families have
      // hundreds of services and still inherit their category's description;
      // `oss` has two, so it is where the field earns its keep first.
      descriptionKey: `elements.oss.services.${service.id}.description`,
    })),
  ),

  icons: ossIconResolver,

  card: {
    component: CardNode,
    handles: SPREAD_HANDLES,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },

  export: {
    toExportNode: (comp, base) => {
      const cloudService = resolveCloudServiceId(comp);
      const service = cloudService ? OSS_SERVICE_MAP.get(cloudService) : undefined;
      const dataUri = service ? ossIconDataUri(service.iconName) : null;

      if (dataUri) {
        return {
          ...base,
          kind: "image",
          name: comp.name,
          dataUri,
          preserveAspect: true,
        };
      }

      return {
        ...base,
        kind: "passthrough",
        name: comp.name,
        description:
          service?.name ??
          ("technology" in comp && typeof comp.technology === "string"
            ? comp.technology
            : undefined),
        originType: comp.type,
        originLabel: i18n.t("canvasToolbar.ossServices"),
      };
    },
  },

  defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
  patchableKeys: ["cloudServiceId", "technology", "customColor"],

  attachService: (base, categoryId, serviceId) => {
    if (!isOssCategoryId(categoryId)) {
      throw new Error(
        `[elements] oss attachService got categoryId "${categoryId}"; expected an oss-* id.`,
      );
    }
    return {
      ...base,
      type: asOssCategoryType(categoryId),
      ...cloudServiceIdWrite(serviceId),
    } as Component;
  },
};

export const ossElements = buildCloudFamilyDescriptors(ossFamily);
