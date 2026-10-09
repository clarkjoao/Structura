import type { ElementTypeId } from "../element.types";
import { allCloudFamilies, getCloudFamily } from "../families/cloud-family.registry";
import type { CloudFamilyDefinition } from "../families/cloud-family.types";
import type { CatalogConceptId } from "../search/concepts";

/** A catalog service as an element: the category it is created as, and its id. */
export interface ConceptService {
  type: ElementTypeId;
  serviceId: string;
}

function resolveIn(
  family: CloudFamilyDefinition,
  concept: CatalogConceptId,
): ConceptService | null {
  const tagged = family.services.filter((service) => service.concepts?.includes(concept));
  const preferredId = family.preferredServiceByConcept?.[concept];
  const service = tagged.find((candidate) => candidate.id === preferredId) ?? tagged[0];
  const category = service && family.categories.find((c) => c.id === service.categoryId);
  return service && category ? { type: category.id, serviceId: service.id } : null;
}

/**
 * The service of `familyId` that does the job `concept` names, or null when
 * the family has none — a gap, which a caller fills with something neutral,
 * never with a guessed id. Derived from each service's `concepts`; the
 * family's `preferredServiceByConcept` breaks ties.
 *
 * @example serviceForConcept("aws", "queue") // { type: "aws-integration", serviceId: "sqs" }
 */
export function serviceForConcept(
  familyId: string,
  concept: CatalogConceptId,
): ConceptService | null {
  const family = getCloudFamily(familyId);
  return family ? resolveIn(family, concept) : null;
}

/** Catalog families that can stand in for at least one of `concepts`, in registration order. */
export function familiesResolving(concepts: readonly CatalogConceptId[]): CloudFamilyDefinition[] {
  return allCloudFamilies().filter((family) =>
    concepts.some((concept) => resolveIn(family, concept) !== null),
  );
}
