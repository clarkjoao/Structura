import { cloudServiceIdWrite } from "@/features/diagram/model/cloud-service-id";
import { isGcpType } from "@/features/cloud/providers/gcp/gcp.catalog";
import { gcpIconResolver } from "@/features/cloud/providers/gcp/gcp.icon-resolver";
import gcpPackJson from "../../packs/gcp/pack.json";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import type { PackAdapter } from "../../packs/pack.adapter";
import { familyFromPack } from "../../packs/pack.loader";
import { parsePack } from "../../packs/pack.schema";
import { gcpIconDataUri } from "./gcp.export-icons";

/**
 * Google Cloud: the data is the `gcp` element pack (`packs/gcp/pack.json`). What is not data
 * is the icon source — the `gcp-icons` npm pack, by file name — and the guard for the persisted
 * `gcp-*` ids. Export is the pack default: the icon as an image, else passthrough.
 */
export const gcpPack = parsePack(gcpPackJson, "built-in pack");

export const gcpPackAdapter: PackAdapter = {
  icons: gcpIconResolver,
  iconDataUri: gcpIconDataUri,
  typeIdOf: (typeId) => (isGcpType(typeId) ? typeId : undefined),
  attachService: (base, categoryId, serviceId) => {
    if (!isGcpType(categoryId)) {
      throw new Error(
        `[elements] gcp attachService got categoryId "${categoryId}"; expected a gcp-* id.`,
      );
    }
    return { ...base, type: categoryId, ...cloudServiceIdWrite(serviceId) };
  },
};

export const gcpFamily: CloudFamilyDefinition = familyFromPack(gcpPack, gcpPackAdapter);

/** Descriptors produced by the family — one per GCP category. */
export const gcpElements = buildCloudFamilyDescriptors(gcpFamily);
