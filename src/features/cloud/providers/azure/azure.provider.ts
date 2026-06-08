import {
  AZURE_CATEGORIES,
  AZURE_CATEGORY_MAP,
  AZURE_SERVICE_MAP,
  isAzureType,
} from "./azure.catalog";
import type {
  CloudCategory,
  CloudProviderAdapter,
  CloudService,
} from "../../model/cloud.types";
import { azureIconResolver } from "./azure.icon-resolver";

const AZURE_CATEGORY_BORDERS: Record<string, string> = {
  "azure-compute": "border-l-azure-compute",
  "azure-storage": "border-l-azure-storage",
  "azure-database": "border-l-azure-database",
  "azure-networking": "border-l-azure-networking",
  "azure-security": "border-l-azure-security",
  "azure-analytics": "border-l-azure-analytics",
  "azure-ai": "border-l-azure-ai",
  "azure-integration": "border-l-azure-integration",
  "azure-devtools": "border-l-azure-devtools",
  "azure-iot": "border-l-azure-iot",
  "azure-management": "border-l-azure-management",
  "azure-media": "border-l-azure-media",
  "azure-general": "border-l-azure-general",
};

const categories: CloudCategory[] = AZURE_CATEGORIES.map((cat) => ({
  id: cat.id,
  providerId: "azure",
  name: cat.name,
}));

const services: CloudService[] = AZURE_CATEGORIES.flatMap((cat) =>
  cat.services.map((svc) => ({
    id: svc.id,
    name: svc.name,
    iconName: svc.iconName,
    categoryId: cat.id,
  })),
);

export const azureProvider: CloudProviderAdapter = {
  id: "azure",
  name: "Microsoft Azure",
  typePrefix: "azure-",
  categories,
  services,
  iconResolver: azureIconResolver,

  matchesType: (type) => isAzureType(type),

  getCategoryForType: (type) => {
    const cat = AZURE_CATEGORY_MAP.get(type);
    if (!cat) return undefined;
    return { id: cat.id, providerId: "azure", name: cat.name };
  },

  getService: (serviceId) => {
    const svc = AZURE_SERVICE_MAP.get(serviceId);
    if (!svc) return undefined;
    return {
      id: svc.id,
      name: svc.name,
      iconName: svc.iconName,
      categoryId: svc.categoryId,
    };
  },

  getCategoryStyle: (categoryId) => ({
    borderClass: AZURE_CATEGORY_BORDERS[categoryId] ?? "border-l-azure-general",
  }),
};
