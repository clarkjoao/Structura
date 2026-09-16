import { AWS_CATEGORIES, AWS_CATEGORY_MAP, AWS_SERVICE_MAP, isAwsType } from "./aws.catalog";
import type { CloudCategory, CloudProviderAdapter, CloudService } from "../../model/cloud.types";
import { awsIconResolver } from "./aws.icon-resolver";

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

  // No dedicated border map: same formula as GCP/Azure and borderClassForAccent.
  getCategoryStyle: (categoryId) => ({
    borderClass: `border-l-${categoryId}`,
  }),
};
