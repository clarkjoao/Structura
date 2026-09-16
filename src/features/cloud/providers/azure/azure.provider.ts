import {
  AZURE_CATEGORIES,
  AZURE_CATEGORY_MAP,
  AZURE_SERVICE_MAP,
  isAzureType,
} from "./azure.catalog";
import type { CloudCategory, CloudProviderAdapter, CloudService } from "../../model/cloud.types";
import { azureIconResolver } from "./azure.icon-resolver";

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

  // No dedicated border map: same formula as `borderClassForAccent` / GCP.
  getCategoryStyle: (categoryId) => ({
    borderClass: `border-l-${categoryId}`,
  }),
};
