import k8sPack from "@/features/elements/packs/k8s/pack.json";
import { catalogView } from "@/features/elements/packs/catalog-view";

/**
 * Kubernetes catalog-shaped family data.
 *
 * Categories follow the resource groups architects draw most often. Namespace
 * and Cluster are intentionally omitted as categories: they are grouping
 * containers (closer to `panel` / PANEL_KINDS) than card services, and
 * `CloudFamilyDefinition` can only produce cards — every category it builds is
 * `role: "card"`, `canBeParent: false` (see `build-cloud-family-descriptors`).
 *
 * That is a known limit of the family contract, not an oversight in this
 * catalog. The options for lifting it are weighed in
 * `docs/audits/correcao-achados-auditoria.md` (item 6); it is an open decision,
 * so nothing here should be changed to work around it in the meantime.
 *
 * The data lives in its element pack (`elements/packs/k8s/pack.json`) — add a resource there.
 *
 * Category ids live on `ComponentType` / `K8sComponent` (same shape as AWS).
 * This module stays a leaf so `component.types.ts` can import the id union
 * without a cycle through `element.types`.
 */
export const K8S_CATEGORY_IDS = [
  "k8s-workloads",
  "k8s-networking",
  "k8s-storage",
  "k8s-config",
] as const;

export type K8sCategoryId = (typeof K8S_CATEGORY_IDS)[number];

export interface K8sService {
  id: string;
  name: string;
  /** Filename stem under `elements/packs/k8s/icons/` (community unlabeled SVG). */
  iconName: string;
  categoryId: K8sCategoryId;
}

export interface K8sCategory {
  id: K8sCategoryId;
  name: string;
  services: readonly K8sService[];
}

export function isK8sCategoryId(type: string): type is K8sCategoryId {
  return (K8S_CATEGORY_IDS as readonly string[]).includes(type);
}

export const K8S_CATEGORIES: readonly K8sCategory[] = catalogView(k8sPack, isK8sCategoryId).map(
  (category) => ({
    ...category,
    services: category.services.map((service) => ({ ...service, categoryId: category.id })),
  }),
);

export const K8S_SERVICE_MAP = new Map<string, K8sService>(
  K8S_CATEGORIES.flatMap((category) => category.services.map((service) => [service.id, service])),
);
