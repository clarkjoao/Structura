import { cloudServiceIdWrite } from "@/features/diagram/model/cloud-service-id";
import k8sPackJson from "../../packs/k8s/pack.json";
import type { CloudFamilyDefinition } from "../cloud-family.types";
import { buildCloudFamilyDescriptors } from "../build-cloud-family-descriptors";
import type { PackAdapter } from "../../packs/pack.adapter";
import { builtinPackIcons, packIconResolver } from "../../packs/pack.icons";
import { familyFromPack } from "../../packs/pack.loader";
import { parsePack } from "../../packs/pack.schema";
import { isK8sCategoryId } from "./k8s.catalog";

/**
 * Kubernetes resources as cards: the data is the `k8s` element pack (`packs/k8s/pack.json`,
 * community SVGs beside it). The cluster, namespace and workload containers are hand-written
 * elements under `./structure`, registered under the same family id. Export is the pack
 * default — there is no mxgraph.kubernetes kind in this repo.
 */
export const k8sPack = parsePack(k8sPackJson, "built-in pack");

export const k8sPackIcons = builtinPackIcons("k8s");

export const k8sPackAdapter: PackAdapter = {
  icons: packIconResolver(k8sPackIcons),
  typeIdOf: (typeId) => (isK8sCategoryId(typeId) ? typeId : undefined),
  attachService: (base, categoryId, serviceId) => {
    if (!isK8sCategoryId(categoryId)) {
      throw new Error(
        `[elements] k8s attachService got categoryId "${categoryId}"; expected a k8s-* id.`,
      );
    }
    return { ...base, type: categoryId, ...cloudServiceIdWrite(serviceId) };
  },
};

export const k8sFamily: CloudFamilyDefinition = familyFromPack(
  k8sPack,
  k8sPackAdapter,
  k8sPackIcons,
);

/** Descriptors produced by the family — one per K8s category. */
export const k8sElements = buildCloudFamilyDescriptors(k8sFamily);
