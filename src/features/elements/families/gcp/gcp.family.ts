import CustomNode from "@/features/canvas/nodes/CustomNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CustomNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { isGcpComponent } from "@/features/diagram/model/component.guards";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import {
  GCP_CATEGORIES,
  GCP_SERVICE_MAP,
  isGcpType,
  type GcpCategoryId,
} from "@/features/cloud/providers/gcp/gcp.catalog";
import { gcpIconResolver } from "@/features/cloud/providers/gcp/gcp.icon-resolver";
import i18n from "@/infrastructure/i18n";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import { gcpIconDataUri } from "./gcp.export-icons";

/**
 * Accent token for a GCP category.
 *
 * The CSS variable matches `src/index.css` (`--gcp-compute`, …). CustomNode
 * (and later a single border reader) turns `{ kind: "token", cssVar }` into
 * the Tailwind `border-l-*` class — replacing `GCP_CATEGORY_BORDERS`.
 */
function accentFor(categoryId: GcpCategoryId) {
  return { kind: "token" as const, cssVar: `--${categoryId}` };
}

/**
 * Google Cloud Platform as a `CloudFamilyDefinition`.
 *
 * Catalog and icon resolver stay under `cloud/providers/gcp` so
 * `cloudRegistry` keeps answering for AWS/Azure-era callers; this module is
 * the element-registry view of the same data.
 */
export const gcpFamily: CloudFamilyDefinition = {
  id: "gcp",
  labelKey: "canvasToolbar.gcpServices",
  paletteCategoryId: "gcp",

  categories: GCP_CATEGORIES.map((category) => ({
    id: category.id,
    labelKey: `elements.gcp.categories.${category.id}.label`,
    descriptionKey: `elements.gcp.categories.${category.id}.description`,
    accent: accentFor(category.id),
  })),

  services: GCP_CATEGORIES.flatMap((category) =>
    category.services.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      categoryId: category.id,
    })),
  ),

  icons: gcpIconResolver,

  card: {
    component: CustomNode,
    handles: SPREAD_HANDLES,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },

  export: {
    toExportNode: (comp, base) => {
      if (!isGcpComponent(comp)) {
        throw new Error(`[elements] gcp export received a ${comp.type} component.`);
      }

      const cloudService = resolveCloudServiceId(comp);
      const service = cloudService ? GCP_SERVICE_MAP.get(cloudService) : undefined;
      const dataUri = service ? gcpIconDataUri(service.iconName) : null;

      if (dataUri) {
        return {
          ...base,
          kind: "image",
          name: comp.name,
          dataUri,
          preserveAspect: true,
        };
      }

      // Floor from F2: no mxgraph GCP pack, and the SVG was missing from the
      // npm icon set — keep the identity rather than disguising as C4.
      return {
        ...base,
        kind: "passthrough",
        name: comp.name,
        description: service?.name ?? comp.technology,
        originType: comp.type,
        originLabel: i18n.t("canvasToolbar.gcpServices"),
      };
    },
  },

  defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
  patchableKeys: ["gcpService", "technology", "customColor"],

  attachService: (base, categoryId, serviceId) => {
    if (!isGcpType(categoryId)) {
      throw new Error(
        `[elements] gcp attachService got categoryId "${categoryId}"; expected a gcp-* id.`,
      );
    }
    return {
      ...base,
      type: categoryId,
      gcpService: serviceId,
    };
  },
};

/** Descriptors produced by the family — one per GCP category. */
export const gcpElements = buildCloudFamilyDescriptors(gcpFamily);
