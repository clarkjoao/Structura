import CustomNode from "@/features/canvas/nodes/CustomNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CustomNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { isAwsComponent } from "@/features/diagram/model/component.guards";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import {
  AWS_CATEGORIES,
  isAwsType,
  type AwsCategoryId,
} from "@/features/cloud/providers/aws/aws.catalog";
import { awsIconResolver } from "@/features/cloud/providers/aws/aws.icon-resolver";
import { awsServiceCache } from "@/lib/export-service/aws-cache";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";

/**
 * Services featured in the "All" / spotlight strips of the picker.
 *
 * Kept next to the family so the catalog and the spotlight stay one source;
 * `element-picker/constants.ts` re-exports for existing call sites.
 */
export const AWS_FAMILY_SPOTLIGHT_SERVICE_IDS: readonly string[] = [
  "ec2",
  "lambda",
  "s3",
  "rds",
  "elb",
  "ecs",
  "eks",
  "vpc",
  "cloudfront",
  "dynamodb",
  "sqs",
  "api-gateway",
];

/** Categories shown first in the AWS browse view. */
export const AWS_FAMILY_PRIMARY_CATEGORY_IDS: readonly string[] = [
  "aws-compute",
  "aws-networking",
  "aws-storage",
  "aws-database",
  "aws-security",
  "aws-containers",
];

function accentFor(categoryId: AwsCategoryId) {
  return { kind: "token" as const, cssVar: `--${categoryId}` };
}

/**
 * Amazon Web Services as a `CloudFamilyDefinition`.
 *
 * Unlike GCP (`kind: "image"`) and Azure (`passthrough`), AWS has a real
 * mxgraph de-para (`AWS_RESICON` via `awsServiceCache`). Missing entries still
 * resolve to `"general"` — the same behaviour `main` had for ~services without
 * a dedicated icon — so migrating the family does not change export fidelity.
 */
export const awsFamily: CloudFamilyDefinition = {
  id: "aws",
  labelKey: "canvasToolbar.awsServices",
  paletteCategoryId: "aws",

  categories: AWS_CATEGORIES.map((category) => {
    const id = category.id as AwsCategoryId;
    return {
      id,
      labelKey: `elements.aws.categories.${id}.label`,
      descriptionKey: `elements.aws.categories.${id}.description`,
      accent: accentFor(id),
    };
  }),

  services: AWS_CATEGORIES.flatMap((category) =>
    category.services.map((service) => ({
      id: service.id,
      name: service.name,
      iconName: service.iconName,
      categoryId: category.id as AwsCategoryId,
    })),
  ),

  icons: awsIconResolver,

  card: {
    component: CustomNode,
    handles: SPREAD_HANDLES,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },

  export: {
    toExportNode: (comp, base) => {
      if (!isAwsComponent(comp)) {
        throw new Error(`[elements] aws export received a ${comp.type} component.`);
      }

      // Preserves AWS_RESICON: cache returns `"general"` when the service has
      // no dedicated mxgraph id (parity with main, not a silent downgrade to
      // passthrough).
      return {
        ...base,
        kind: "aws",
        name: comp.name,
        awsIcon: awsServiceCache.getInfo(resolveCloudServiceId(comp) ?? "").icon,
      };
    },
  },

  defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
  patchableKeys: ["cloudServiceId", "technology", "customColor"],

  attachService: (base, categoryId, serviceId) => {
    if (!isAwsType(categoryId)) {
      throw new Error(
        `[elements] aws attachService got categoryId "${categoryId}"; expected an aws-* id.`,
      );
    }
    return {
      ...base,
      type: categoryId,
      cloudServiceId: serviceId,
    };
  },
};

/** Descriptors produced by the family — one per AWS category. */
export const awsElements = buildCloudFamilyDescriptors(awsFamily);
