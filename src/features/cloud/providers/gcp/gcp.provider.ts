import { GCP_CATEGORIES, GCP_CATEGORY_MAP, GCP_SERVICE_MAP, isGcpType } from "./gcp.catalog";
import type { CloudCategory, CloudProviderAdapter, CloudService } from "../../model/cloud.types";
import { gcpIconResolver } from "./gcp.icon-resolver";

const GCP_CATEGORY_BORDERS: Record<string, string> = {
  "gcp-compute": "border-l-gcp-compute",
  "gcp-storage": "border-l-gcp-storage",
  "gcp-database": "border-l-gcp-database",
  "gcp-networking": "border-l-gcp-networking",
  "gcp-security": "border-l-gcp-security",
  "gcp-analytics": "border-l-gcp-analytics",
  "gcp-ai": "border-l-gcp-ai",
  "gcp-devtools": "border-l-gcp-devtools",
  "gcp-integration": "border-l-gcp-integration",
  "gcp-management": "border-l-gcp-management",
  "gcp-media": "border-l-gcp-media",
  "gcp-general": "border-l-gcp-general",
};

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

  getCategoryStyle: (categoryId) => ({
    borderClass: GCP_CATEGORY_BORDERS[categoryId] ?? "border-l-gcp-general",
  }),
};
