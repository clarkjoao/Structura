import {
  cloudServiceIdWrite,
  resolveCloudServiceId,
} from "@/features/diagram/model/cloud-service-id";
import { isAwsType } from "@/features/cloud/providers/aws/aws.catalog";
import { awsIconResolver } from "@/features/cloud/providers/aws/aws.icon-resolver";
import { awsServiceCache } from "@/lib/export-service/aws-cache";
import awsPackJson from "../../packs/aws/pack.json";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import type { PackAdapter } from "../../packs/pack.adapter";
import { familyFromPack } from "../../packs/pack.loader";
import { parsePack } from "../../packs/pack.schema";

/**
 * Amazon Web Services: the data is the `aws` element pack (`packs/aws/pack.json`) — services,
 * categories, spotlight and concepts. What is not data stays here: icons from
 * `aws-react-icons` by component name, and the native mxgraph export (`AWS_RESICON` via
 * `awsServiceCache`). Missing entries still resolve to `"general"` — the same behaviour `main`
 * had — so the migration does not change export fidelity.
 */
export const awsPack = parsePack(awsPackJson, "built-in pack");

export const awsPackAdapter: PackAdapter = {
  icons: awsIconResolver,
  typeIdOf: (typeId) => (isAwsType(typeId) ? typeId : undefined),
  attachService: (base, categoryId, serviceId) => {
    if (!isAwsType(categoryId)) {
      throw new Error(
        `[elements] aws attachService got categoryId "${categoryId}"; expected an aws-* id.`,
      );
    }
    return { ...base, type: categoryId, ...cloudServiceIdWrite(serviceId) };
  },
  toExportNode: (comp, base) => {
    const cloudServiceId = resolveCloudServiceId(comp);
    return {
      ...base,
      kind: "aws",
      name: comp.name,
      awsIcon: awsServiceCache.getInfo(cloudServiceId ?? "").icon,
      // Same control point as domain writes — projects onto ExportNode only.
      ...cloudServiceIdWrite(cloudServiceId),
    };
  },
};

export const awsFamily: CloudFamilyDefinition = familyFromPack(awsPack, awsPackAdapter);

/** Services the element catalog lists first for AWS (see `spotlightServiceIds`). */
export const AWS_FAMILY_SPOTLIGHT_SERVICE_IDS: readonly string[] =
  awsFamily.spotlightServiceIds ?? [];

/** Categories shown first in the AWS browse view. */
export const AWS_FAMILY_PRIMARY_CATEGORY_IDS: readonly string[] =
  awsFamily.primaryCategoryIds ?? [];

/** Descriptors produced by the family — one per AWS category. */
export const awsElements = buildCloudFamilyDescriptors(awsFamily);
