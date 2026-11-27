import awsPack from "@/features/elements/packs/aws/pack.json";
import { catalogView } from "@/features/elements/packs/catalog-view";

export interface AwsService {
  id: string;
  name: string;
  iconName: string;
}

export interface AwsCategory {
  id: string;
  name: string;
  services: AwsService[];
}

/**
 * The AWS catalog, read from its element pack (`elements/packs/aws/pack.json`) — add a service
 * there, not here. This module stays a leaf: the domain guards and the LLM IR import it.
 */
export const AWS_CATEGORIES: AwsCategory[] = catalogView(awsPack, isAwsType);

const _serviceMap = new Map<string, AwsService & { categoryId: string }>();
AWS_CATEGORIES.forEach((cat) => {
  cat.services.forEach((svc) => {
    _serviceMap.set(svc.id, { ...svc, categoryId: cat.id });
  });
});
export const AWS_SERVICE_MAP = _serviceMap;

/**
 * The AWS category ids, as persisted in `Component.type`. A pack category must be listed here
 * (`legacy-packs.parity.test.ts` holds the two to each other): these ids type saved diagrams.
 */
export const AWS_CATEGORY_IDS = [
  "aws-compute",
  "aws-storage",
  "aws-database",
  "aws-networking",
  "aws-security",
  "aws-analytics",
  "aws-ml",
  "aws-integration",
  "aws-management",
  "aws-developer",
  "aws-containers",
  "aws-media",
  "aws-migration",
  "aws-iot",
  "aws-end-user",
  "aws-general",
] as const;

export type AwsCategoryId = (typeof AWS_CATEGORY_IDS)[number];

export const AWS_CATEGORY_ID_GENERAL = "aws-general" as const satisfies AwsCategoryId;

export function isAwsType(type: string): type is AwsCategoryId {
  return type.startsWith("aws-");
}
