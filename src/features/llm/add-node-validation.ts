import { cloudRegistry } from "@/features/cloud";
import { hasElement } from "@/features/elements/element.registry";
import { allCloudFamilies } from "@/features/elements/families/cloud-family.registry";
import type { DiagramPatchAction } from "./types";
import type { SearchElementsResult } from "./element-catalog-query";

export type AddNodeValidation = { ok: true } | { ok: false; reason: string };

function catalogHitKey(elementType: string, serviceId: string | null): string {
  return `${elementType}\0${serviceId ?? ""}`;
}

/**
 * True when `nodeType` is a cloud/tech category that carries service variants.
 *
 * @example
 * isCloudCatalogType("oss-datastore") // true
 * isCloudCatalogType("system") // false
 */
export function isCloudCatalogType(nodeType: string): boolean {
  return cloudRegistry.isCloudType(nodeType);
}

/**
 * Registry check: type must exist; when a service id is given (or the type is
 * a cloud category with services), the pair must match a registered service.
 *
 * @example
 * validateAddNodeAgainstRegistry("oss-datastore", "redis") // { ok: true }
 * validateAddNodeAgainstRegistry("oss-datastore", "nope") // { ok: false, … }
 */
export function validateAddNodeAgainstRegistry(
  nodeType: string,
  serviceId?: string | null,
): AddNodeValidation {
  if (!hasElement(nodeType)) {
    return {
      ok: false,
      reason: `Unknown nodeType "${nodeType}"; expected a registered element id.`,
    };
  }

  const family = allCloudFamilies().find((entry) =>
    entry.categories.some((category) => category.id === nodeType),
  );
  if (!family) {
    // Structural / C4 / other non-cloud: service ids are not used.
    if (serviceId) {
      return {
        ok: false,
        reason: `nodeType "${nodeType}" does not accept serviceId "${serviceId}".`,
      };
    }
    return { ok: true };
  }

  const services = family.services.filter((service) => service.categoryId === nodeType);
  if (services.length === 0) {
    return serviceId
      ? {
          ok: false,
          reason: `Category "${nodeType}" has no services; unexpected serviceId "${serviceId}".`,
        }
      : { ok: true };
  }

  if (!serviceId) {
    return {
      ok: false,
      reason: `Cloud category "${nodeType}" requires a serviceId from the catalog (e.g. via search_elements).`,
    };
  }

  const match = services.find((service) => service.id === serviceId);
  if (!match) {
    return {
      ok: false,
      reason: `serviceId "${serviceId}" is not registered under category "${nodeType}".`,
    };
  }
  return { ok: true };
}

/** Collect (elementType, serviceId) pairs returned by search_elements in this patch. */
export function collectConfirmedCatalogHits(searchResults: SearchElementsResult[]): Set<string> {
  const hits = new Set<string>();
  for (const batch of searchResults) {
    for (const row of batch.results) {
      hits.add(catalogHitKey(row.elementType, row.serviceId));
    }
  }
  return hits;
}

/**
 * When this patch already ran search_elements, cloud add_node targets must
 * appear in those results (same-turn dependency resolution without a model loop).
 */
export function validateAddNodeAgainstConfirmedHits(
  nodeType: string,
  serviceId: string | null | undefined,
  confirmedHits: Set<string>,
): AddNodeValidation {
  if (!isCloudCatalogType(nodeType)) {
    return { ok: true };
  }
  const key = catalogHitKey(nodeType, serviceId ?? null);
  if (!confirmedHits.has(key)) {
    return {
      ok: false,
      reason:
        `Cloud add_node (${nodeType}, serviceId=${serviceId ?? "null"}) was not ` +
        `returned by search_elements in this same patch. Call search_elements first ` +
        `and only add_node with an exact hit (or wait for the next turn).`,
    };
  }
  return { ok: true };
}

export function patchContainsSearchElements(actions: DiagramPatchAction[]): boolean {
  return actions.some((action) => action.type === "SEARCH_ELEMENTS");
}
