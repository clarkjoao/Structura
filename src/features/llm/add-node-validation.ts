import { cloudRegistry } from "@/features/cloud";
import { hasElement } from "@/features/elements/element.registry";
import { allCloudFamilies } from "@/features/elements/families/cloud-family.registry";

export type AddNodeValidation = { ok: true } | { ok: false; reason: string };

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

/**
 * Why there is no same-turn "must appear in this patch's search results" gate.
 *
 * F8b added one: when a patch contained `search_elements`, every cloud
 * `add_node` in that patch had to be an exact `(elementType, serviceId)` pair
 * returned by those searches. It rejected valid nodes. `search_elements("redis")`
 * followed by `add_node("aws-compute", "lambda")` dropped the Lambda — a real,
 * registered service — because the model had searched for something else in the
 * same response. Searching made the model *more* constrained, so the better it
 * behaved (look one thing up, compose the rest from the prompt catalog) the more
 * work was silently discarded.
 *
 * The gate cannot be narrowed to "only the add_nodes the searches covered"
 * either: a search's scope is a text query, not a namespace, so
 * `search_elements("redis", family "oss")` does not cover `(oss-messaging,
 * kafka)` any more than it covers Lambda. Deciding whether a pair was "in
 * scope" is the same computation as re-running the search, which is what the
 * rejected gate already did.
 *
 * `validateAddNodeAgainstRegistry` is sound and sufficient for the property
 * that actually matters: the pair exists. An invented type or an invented
 * service id is rejected whether or not a search ran; a registered pair is
 * valid whether or not the model looked it up this turn. Catalog reads still
 * run before writes (`runCatalogReadActions`) so the model can act on results
 * in one turn — that ordering was the useful half of F8b and it stays.
 */
