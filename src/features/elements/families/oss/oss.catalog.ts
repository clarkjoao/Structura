/**
 * Flat OSS family: one category per nature of software, few services each.
 *
 * Same `CloudFamilyDefinition` shape as hyperscalers/K8s — categories still
 * become descriptors; services become palette variants. No contract change.
 *
 * Category ids live on `ComponentType` / `OssComponent` (same shape as AWS).
 * This module stays a leaf so `component.types.ts` can import the id union
 * without a cycle through `element.types`.
 */
export type OssCategoryId = "oss-datastore" | "oss-messaging";

export interface OssService {
  id: string;
  name: string;
  iconName: string;
  categoryId: OssCategoryId;
}

export interface OssCategory {
  id: OssCategoryId;
  name: string;
  services: readonly OssService[];
}

/** Identity helper kept for call sites that already name the catalog boundary. */
export function asOssCategoryType(id: OssCategoryId): OssCategoryId {
  return id;
}

export const OSS_CATEGORIES: readonly OssCategory[] = [
  {
    id: "oss-datastore",
    name: "Datastore",
    services: [{ id: "redis", name: "Redis", iconName: "redis", categoryId: "oss-datastore" }],
  },
  {
    id: "oss-messaging",
    name: "Messaging",
    services: [
      { id: "kafka", name: "Apache Kafka", iconName: "kafka", categoryId: "oss-messaging" },
    ],
  },
];

export const OSS_SERVICE_MAP = new Map<string, OssService>(
  OSS_CATEGORIES.flatMap((category) => category.services.map((service) => [service.id, service])),
);

export function isOssCategoryId(type: string): type is OssCategoryId {
  return type === "oss-datastore" || type === "oss-messaging";
}
