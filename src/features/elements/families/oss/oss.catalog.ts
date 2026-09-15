import type { ElementTypeId } from "@/features/elements/element.types";

/**
 * Flat OSS family: one category per nature of software, few services each.
 *
 * Same `CloudFamilyDefinition` shape as hyperscalers/K8s — categories still
 * become descriptors; services become palette variants. No contract change.
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

export function asOssCategoryType(id: OssCategoryId): ElementTypeId {
  return id as ElementTypeId;
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
