import ossPack from "@/features/elements/packs/oss/pack.json";
import { catalogView } from "@/features/elements/packs/catalog-view";

/**
 * Flat OSS family: one category per nature of software, few services each.
 *
 * The data lives in its element pack (`elements/packs/oss/pack.json`) — add a service there.
 * Category ids live on `ComponentType` / `OssComponent` (same shape as AWS). This module stays a
 * leaf so `component.types.ts` can import the id union without a cycle through `element.types`.
 */
export const OSS_CATEGORY_IDS = ["oss-datastore", "oss-messaging"] as const;

export type OssCategoryId = (typeof OSS_CATEGORY_IDS)[number];

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

export function isOssCategoryId(type: string): type is OssCategoryId {
  return (OSS_CATEGORY_IDS as readonly string[]).includes(type);
}

export const OSS_CATEGORIES: readonly OssCategory[] = catalogView(ossPack, isOssCategoryId).map(
  (category) => ({
    ...category,
    services: category.services.map((service) => ({ ...service, categoryId: category.id })),
  }),
);

export const OSS_SERVICE_MAP = new Map<string, OssService>(
  OSS_CATEGORIES.flatMap((category) => category.services.map((service) => [service.id, service])),
);
