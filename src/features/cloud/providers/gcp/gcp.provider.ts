import { GCP_CATEGORIES, GCP_CATEGORY_MAP, GCP_SERVICE_MAP, isGcpType } from "./gcp.catalog";
import type { CloudCategory, CloudProviderAdapter, CloudService } from "../../model/cloud.types";
import { gcpIconResolver } from "./gcp.icon-resolver";

const categories: CloudCategory[] = GCP_CATEGORIES.map((cat) => ({
  id: cat.id,
  providerId: "gcp",
  name: cat.name,
}));

const services: CloudService[] = GCP_CATEGORIES.flatMap((cat) =>
  cat.services.map((svc) => ({
    id: svc.id,
    name: svc.name,
    iconName: svc.iconName,
    categoryId: cat.id,
  })),
);

export const gcpProvider: CloudProviderAdapter = {
  id: "gcp",
  name: "Google Cloud Platform",
  typePrefix: "gcp-",
  categories,
  services,
  iconResolver: gcpIconResolver,

  matchesType: (type) => isGcpType(type),

  getCategoryForType: (type) => {
    const cat = GCP_CATEGORY_MAP.get(type);
    if (!cat) return undefined;
    return { id: cat.id, providerId: "gcp", name: cat.name };
  },

  getService: (serviceId) => {
    const svc = GCP_SERVICE_MAP.get(serviceId);
    if (!svc) return undefined;
    return {
      id: svc.id,
      name: svc.name,
      iconName: svc.iconName,
      categoryId: svc.categoryId,
    };
  },

  // No dedicated border map: the class name is the category id, same formula
  // `borderClassForAccent` derives from `palette.accent` on the descriptor.
  getCategoryStyle: (categoryId) => ({
    borderClass: `border-l-${categoryId}`,
  }),
};
