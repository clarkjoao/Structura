import type {
  CloudProviderAdapter,
  CloudCategory,
  CloudService,
} from "@/features/cloud/model/cloud.types";
import { cloudRegistry } from "@/features/cloud/registry/cloud.registry";
import { registerElement, hasElement, unregisterElement, allElements } from "../element.registry";
import type { CloudFamilyDefinition } from "./cloud-family.types";
import { buildCloudFamilyDescriptors } from "./build-cloud-family-descriptors";
import { forgetFamilyIconResolver } from "./family-icon-resolvers";
import i18n from "@/infrastructure/i18n";

/**
 * Catalog-shaped families registered through `registerCloudFamily`.
 *
 * Open string set (not a closed aws|gcp|azure union). Validated when a family
 * registers: duplicate ids throw. Consumers iterate `allCloudFamilies()` —
 * they must not switch on a hardcoded list of family names.
 */
export type { CloudFamilyId } from "./cloud-family.types";
import type { CloudFamilyId } from "./cloud-family.types";

const families = new Map<CloudFamilyId, CloudFamilyDefinition>();

function fail(id: string, reason: string): never {
  throw new Error(`[elements] Cannot register cloud family "${id}": ${reason}`);
}

/**
 * Materialises descriptors, remembers them under `family.id`, and makes the
 * family visible to palette / LLM / cloudRegistry-derived consumers.
 *
 * @example
 * registerCloudFamily(gcpFamily);
 */
export function registerCloudFamily(family: CloudFamilyDefinition): void {
  if (!family.id) fail(String(family.id), "id is required.");
  if (families.has(family.id)) fail(family.id, "a family with this id is already registered.");

  const descriptors = buildCloudFamilyDescriptors(family);
  for (const descriptor of descriptors) {
    if (!hasElement(descriptor.id)) registerElement(descriptor);
  }
  families.set(family.id, family);
  // Derived view — not a parallel curated list (see cloud/bootstrap.ts).
  cloudRegistry.register(cloudFamilyToProviderAdapter(family));
}

/** Test-only: drop a family and its category descriptors. */
export function unregisterCloudFamily(familyId: CloudFamilyId): void {
  const family = families.get(familyId);
  if (!family) return;
  for (const category of family.categories) {
    unregisterElement(category.id);
  }
  families.delete(familyId);
  cloudRegistry.unregister(familyId);
  forgetFamilyIconResolver(familyId);
}

export function allCloudFamilies(): readonly CloudFamilyDefinition[] {
  return [...families.values()];
}

/**
 * Family ids that are registered but are **not** `registerCloudFamily`
 * catalogs — `structural`, `c4`, and any vocabulary a future descriptor set
 * declares. In registry order.
 *
 * Consumers used to write `"structural"` and `"c4"` out as literals, which made
 * anything else invisible: it rendered on the canvas but had no palette tab, no
 * entry in the LLM family list, and no `add_node` validity. Ask here instead.
 */
export function nonCatalogFamilyIds(): string[] {
  const catalogIds = new Set(families.keys());
  const seen: string[] = [];
  for (const element of allElements()) {
    if (catalogIds.has(element.family) || seen.includes(element.family)) continue;
    seen.push(element.family);
  }
  return seen;
}

export function getCloudFamily(familyId: string): CloudFamilyDefinition | undefined {
  return families.get(familyId);
}

export function isRegisteredCloudFamily(familyId: string): boolean {
  return families.has(familyId);
}

export function cloudFamilyForCategoryType(type: string): CloudFamilyDefinition | undefined {
  for (const family of families.values()) {
    if (family.categories.some((category) => category.id === type)) return family;
  }
  return undefined;
}

/**
 * Derive a `CloudProviderAdapter` from a family definition.
 *
 * `cloudRegistry` survives as a *derived view* for CardNode / CloudIcon /
 * ComponentPanel — not as an independently curated list of providers.
 */
export function cloudFamilyToProviderAdapter(family: CloudFamilyDefinition): CloudProviderAdapter {
  const categoryIds = new Set<string>(family.categories.map((category) => category.id));
  const categories: CloudCategory[] = family.categories.map((category) => ({
    id: category.id,
    providerId: family.id,
    // Proper nouns / i18n keys: same convention as palette variants.
    name: i18n.t(category.labelKey, { lng: "en" }),
  }));
  const services: CloudService[] = family.services.map((service) => ({
    id: service.id,
    name: service.name,
    iconName: service.iconName,
    categoryId: service.categoryId,
  }));
  const serviceById = new Map<string, CloudService>(
    services.map((service) => [service.id, service]),
  );
  const categoryById = new Map<string, CloudCategory>(
    categories.map((category) => [category.id, category]),
  );

  return {
    id: family.id,
    name: i18n.t(family.labelKey, { lng: "en" }),
    typePrefix: `${family.id}-`,
    categories,
    services,
    iconResolver: family.icons,
    matchesType: (type) => categoryIds.has(type),
    getCategoryForType: (type) => categoryById.get(type),
    getService: (serviceId) => serviceById.get(serviceId),
    getCategoryStyle: (categoryId) => ({ borderClass: `border-l-${categoryId}` }),
  };
}
