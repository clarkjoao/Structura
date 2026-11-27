import azurePack from "@/features/elements/packs/azure/pack.json";
import { catalogView } from "@/features/elements/packs/catalog-view";

/**
 * The AZURE category ids, as persisted in `Component.type`. A pack category must be listed here
 * (`legacy-packs.parity.test.ts` holds the two to each other): these ids type saved diagrams.
 */
export const AZURE_CATEGORY_IDS = [
  "azure-compute",
  "azure-storage",
  "azure-database",
  "azure-networking",
  "azure-security",
  "azure-analytics",
  "azure-ai",
  "azure-integration",
  "azure-devtools",
  "azure-iot",
  "azure-management",
  "azure-media",
  "azure-general",
] as const;

export type AzureCategoryId = (typeof AZURE_CATEGORY_IDS)[number];

/** The AZURE catalog, read from its element pack (`elements/packs/azure/pack.json`). */
export const AZURE_CATEGORIES = catalogView(azurePack, isAzureType);

const _categoryMap = new Map<string, (typeof AZURE_CATEGORIES)[number]>();

for (const cat of AZURE_CATEGORIES) {
  _categoryMap.set(cat.id, cat);
}

export function isAzureType(type: string): type is AzureCategoryId {
  return type.startsWith("azure-");
}
