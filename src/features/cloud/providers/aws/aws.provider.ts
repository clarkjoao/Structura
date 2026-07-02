import { AWS_CATEGORIES, AWS_CATEGORY_MAP, AWS_SERVICE_MAP, isAwsType } from "@/lib/catalogs/aws";
import type { CloudCategory, CloudProviderAdapter, CloudService } from "../../model/cloud.types";
import { awsIconResolver } from "./aws.icon-resolver";

const AWS_CATEGORY_BORDERS: Record<string, string> = {
  "aws-compute": "border-l-aws-compute",
  "aws-storage": "border-l-aws-storage",
  "aws-database": "border-l-aws-database",
  "aws-networking": "border-l-aws-networking",
  "aws-security": "border-l-aws-security",
  "aws-analytics": "border-l-aws-analytics",
  "aws-ml": "border-l-aws-ml",
  "aws-integration": "border-l-aws-integration",
  "aws-management": "border-l-aws-management",
  "aws-developer": "border-l-aws-developer",
  "aws-containers": "border-l-aws-containers",
  "aws-media": "border-l-aws-media",
  "aws-migration": "border-l-aws-migration",
  "aws-iot": "border-l-aws-iot",
  "aws-end-user": "border-l-aws-end-user",
  "aws-general": "border-l-aws-general",
};

const categories: CloudCategory[] = AWS_CATEGORIES.map((cat) => ({
  id: cat.id,
  providerId: "aws",
  name: cat.name,
}));

const services: CloudService[] = AWS_CATEGORIES.flatMap((cat) =>
  cat.services.map((svc) => ({
    id: svc.id,
    name: svc.name,
    iconName: svc.iconName,
    categoryId: cat.id,
  })),
);

export const awsProvider: CloudProviderAdapter = {
  id: "aws",
  name: "Amazon Web Services",
  typePrefix: "aws-",
  categories,
  services,
  iconResolver: awsIconResolver,

  matchesType: (type) => isAwsType(type),

  getCategoryForType: (type) => {
    const cat = AWS_CATEGORY_MAP.get(type as Parameters<typeof AWS_CATEGORY_MAP.get>[0]);
    if (!cat) return undefined;
    return { id: cat.id, providerId: "aws", name: cat.name };
  },

  getService: (serviceId) => {
    const svc = AWS_SERVICE_MAP.get(serviceId);
    if (!svc) return undefined;
    return {
      id: svc.id,
      name: svc.name,
      iconName: svc.iconName,
      categoryId: svc.categoryId,
    };
  },

  getCategoryStyle: (categoryId) => ({
    borderClass: AWS_CATEGORY_BORDERS[categoryId] ?? "border-l-aws-general",
  }),
};
