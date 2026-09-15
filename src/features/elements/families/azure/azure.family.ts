import CustomNode from "@/features/canvas/nodes/CustomNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CustomNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { isAzureComponent } from "@/features/diagram/model/component.guards";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import {
  AZURE_CATEGORIES,
  AZURE_SERVICE_MAP,
  isAzureType,
  type AzureCategoryId,
} from "@/features/cloud/providers/azure/azure.catalog";
import { azureIconResolver } from "@/features/cloud/providers/azure/azure.icon-resolver";
import i18n from "@/infrastructure/i18n";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";

function accentFor(categoryId: AzureCategoryId) {
  return { kind: "token" as const, cssVar: `--${categoryId}` };
}

/**
 * Microsoft Azure as a `CloudFamilyDefinition`.
 *
 * Symmetric to GCP (F4). Icons come from `azure-react-icons` (npm React
 * components) via the existing `IconResolver` — no sync SVG pack, so draw.io
 * export uses `passthrough` (F2 floor) rather than `kind: "image"`.
 */
export const azureFamily: CloudFamilyDefinition = {
  id: "azure",
  labelKey: "canvasToolbar.azureServices",
  paletteCategoryId: "azure",

  categories: AZURE_CATEGORIES.map((category) => ({
    id: category.id,
    labelKey: `elements.azure.categories.${category.id}.label`,
    descriptionKey: `elements.azure.categories.${category.id}.description`,
    accent: accentFor(category.id),
  })),

  services: AZURE_CATEGORIES.flatMap((category) =>
    category.services.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      categoryId: category.id,
    })),
  ),

  icons: azureIconResolver,

  card: {
    component: CustomNode,
    handles: SPREAD_HANDLES,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },

  export: {
    toExportNode: (comp, base) => {
      if (!isAzureComponent(comp)) {
        throw new Error(`[elements] azure export received a ${comp.type} component.`);
      }

      const cloudService = resolveCloudServiceId(comp);
      const service = cloudService ? AZURE_SERVICE_MAP.get(cloudService) : undefined;

      // azure-react-icons are React components, not SVGs we can embed as a
      // data URI in the same tick. Passthrough keeps the identity (F2 floor)
      // instead of disguising the node as C4.
      return {
        ...base,
        kind: "passthrough",
        name: comp.name,
        description: service?.name ?? comp.technology,
        originType: comp.type,
        originLabel: i18n.t("canvasToolbar.azureServices"),
      };
    },
  },

  defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
  patchableKeys: ["azureService", "technology", "customColor"],

  attachService: (base, categoryId, serviceId) => {
    if (!isAzureType(categoryId)) {
      throw new Error(
        `[elements] azure attachService got categoryId "${categoryId}"; expected an azure-* id.`,
      );
    }
    return {
      ...base,
      type: categoryId,
      azureService: serviceId,
    };
  },
};

/** Descriptors produced by the family — one per Azure category. */
export const azureElements = buildCloudFamilyDescriptors(azureFamily);
