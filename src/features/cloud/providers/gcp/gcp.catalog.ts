import gcpPack from "@/features/elements/packs/gcp/pack.json";
import { catalogView } from "@/features/elements/packs/catalog-view";

/**
 * The GCP category ids, as persisted in `Component.type`. A pack category must be listed here
 * (`legacy-packs.parity.test.ts` holds the two to each other): these ids type saved diagrams.
 */
export const GCP_CATEGORY_IDS = [
  "gcp-compute",
  "gcp-storage",
  "gcp-database",
  "gcp-networking",
  "gcp-security",
  "gcp-analytics",
  "gcp-ai",
  "gcp-devtools",
  "gcp-integration",
  "gcp-management",
  "gcp-media",
  "gcp-general",
] as const;

export type GcpCategoryId = (typeof GCP_CATEGORY_IDS)[number];

/** The GCP catalog, read from its element pack (`elements/packs/gcp/pack.json`). */
export const GCP_CATEGORIES = catalogView(gcpPack, isGcpType);

const _categoryMap = new Map<string, (typeof GCP_CATEGORIES)[number]>();

for (const cat of GCP_CATEGORIES) {
  _categoryMap.set(cat.id, cat);
}

export const GCP_CATEGORY_MAP = _categoryMap;

export const GCP_CATEGORY_ID_GENERAL = "gcp-general" as const satisfies GcpCategoryId;

export function isGcpType(type: string): type is GcpCategoryId {
  return type.startsWith("gcp-");
}
