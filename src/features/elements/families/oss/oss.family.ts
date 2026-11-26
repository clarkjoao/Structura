import { cloudServiceIdWrite } from "@/features/diagram/model/cloud-service-id";
import ossPackJson from "../../packs/oss/pack.json";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import type { PackAdapter } from "../../packs/pack.adapter";
import { builtinPackIcons, packIconResolver } from "../../packs/pack.icons";
import { familyFromPack } from "../../packs/pack.loader";
import { parsePack } from "../../packs/pack.schema";
import { isOssCategoryId } from "./oss.catalog";

/**
 * Open-source technologies: the data is the `oss` element pack (`packs/oss/pack.json`, icons
 * from Simple Icons beside it); this module is only what is not data — the guard that keeps
 * the persisted `oss-*` ids typed. Export is the pack default (icon image, else passthrough).
 */
export const ossPack = parsePack(ossPackJson, "built-in pack");

export const ossPackIcons = builtinPackIcons("oss");

export const ossPackAdapter: PackAdapter = {
  icons: packIconResolver(ossPackIcons),
  typeIdOf: (typeId) => (isOssCategoryId(typeId) ? typeId : undefined),
  attachService: (base, categoryId, serviceId) => {
    if (!isOssCategoryId(categoryId)) {
      throw new Error(
        `[elements] oss attachService got categoryId "${categoryId}"; expected an oss-* id.`,
      );
    }
    return { ...base, type: categoryId, ...cloudServiceIdWrite(serviceId) };
  },
};

export const ossFamily: CloudFamilyDefinition = familyFromPack(
  ossPack,
  ossPackAdapter,
  ossPackIcons,
);

export const ossElements = buildCloudFamilyDescriptors(ossFamily);
