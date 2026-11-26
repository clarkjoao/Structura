import {
  cloudServiceIdWrite,
  resolveCloudServiceId,
} from "@/features/diagram/model/cloud-service-id";
import { isAzureType } from "@/features/cloud/providers/azure/azure.catalog";
import { azureIconResolver } from "@/features/cloud/providers/azure/azure.icon-resolver";
import i18n from "@/infrastructure/i18n";
import azurePackJson from "../../packs/azure/pack.json";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import type { PackAdapter } from "../../packs/pack.adapter";
import { packKeys } from "../../packs/pack.i18n";
import { familyFromPack } from "../../packs/pack.loader";
import { parsePack } from "../../packs/pack.schema";

/**
 * Microsoft Azure: the data is the `azure` element pack (`packs/azure/pack.json`). Icons come
 * from `azure-react-icons` (React components, not SVGs), so there is no data URI to embed and
 * draw.io export is always passthrough (the F2 floor) rather than an image.
 */
export const azurePack = parsePack(azurePackJson, "built-in pack");

export const azurePackAdapter: PackAdapter = {
  icons: azureIconResolver,
  typeIdOf: (typeId) => (isAzureType(typeId) ? typeId : undefined),
  attachService: (base, categoryId, serviceId) => {
    if (!isAzureType(categoryId)) {
      throw new Error(
        `[elements] azure attachService got categoryId "${categoryId}"; expected an azure-* id.`,
      );
    }
    return { ...base, type: categoryId, ...cloudServiceIdWrite(serviceId) };
  },
  toExportNode: (comp, base, { pack, service }) => ({
    ...base,
    kind: "passthrough",
    name: comp.name,
    description: service?.name ?? ("technology" in comp ? comp.technology : undefined),
    originType: comp.type,
    originLabel: i18n.t(packKeys.label(pack.id)),
    // Same control point as domain writes — projects onto ExportNode only.
    ...cloudServiceIdWrite(resolveCloudServiceId(comp)),
  }),
};

export const azureFamily: CloudFamilyDefinition = familyFromPack(azurePack, azurePackAdapter);

/** Descriptors produced by the family — one per Azure category. */
export const azureElements = buildCloudFamilyDescriptors(azureFamily);
