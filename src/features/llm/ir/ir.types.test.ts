import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { allElements } from "@/features/elements/element.registry";
import {
  coerceTier,
  getIrSemanticTypes,
  irAwsCategoryIdsFromCatalog,
  isBoundarySemanticType,
  isTier,
  TIER_BY_SEMANTIC_TYPE,
  type SemanticType,
} from "./ir.types";

/** The IR's own vocabulary: the static catalog it actually reads. */
const catalogAwsCategoryIds = irAwsCategoryIdsFromCatalog();

/** The other side of the invariant: what the element registry really holds. */
function registeredAwsCategoryIds(): string[] {
  return allElements()
    .filter((element) => element.family === "aws")
    .map((element) => element.id);
}

/** `aws-*` semanticTypes that are IR concepts rather than catalog categories. */
const boundaryTypes = getIrSemanticTypes().filter(isBoundarySemanticType);

describe("the IR AWS vocabulary matches the registered AWS family", () => {
  /**
   * The invariant worth locking, and the one the previous version of this file
   * only appeared to lock: it compared `getIrSemanticTypes()` against
   * `irAwsCategoryIdsFromRegistry()`, but both were built from the same
   * `AWS_CATEGORIES` array, so it asserted `x === x` and no drift between the
   * catalog and the registry could ever fail it.
   *
   * These read the live registry instead. Two honest limits on what that buys:
   *
   * - While `awsFamily.categories` is built from `AWS_CATEGORIES`, the two
   *   sides share a source and cannot drift, so the assertions cannot fail
   *   today. They become falsifiable the moment that derivation stops — a
   *   hand-listed category, or an extra `family: "aws"` element registered
   *   directly — which is exactly the change worth catching. Verified by
   *   adding an unlisted category to the family: this block goes red naming it.
   * - They still cannot catch the failure that caused the revert, an empty
   *   registry snapshot inside the lazily-loaded LLM chunk, because a unit test
   *   runs in one module graph where bootstrap has always run.
   *   `cypress/e2e/ir-generation-smoke.cy.ts` is the guard for that, and it is
   *   the one that caught it.
   */
  it("has a semanticType for every AWS category the registry holds", () => {
    const registered = registeredAwsCategoryIds();
    expect(registered.length).toBeGreaterThan(0);

    const missing = registered.filter(
      (id) => !(getIrSemanticTypes() as readonly string[]).includes(id),
    );
    // A registered category with no semanticType is a trap: the prompt offers
    // the model its services and the validator then rejects the whole diagram
    // with `nodeInvalidSemanticType`.
    expect(missing, `registered AWS categories missing from the IR: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("holds no AWS semanticType the registry does not have", () => {
    const registered = new Set(registeredAwsCategoryIds());
    const orphans = catalogAwsCategoryIds.filter((id) => !registered.has(id));
    expect(orphans, `IR categories with no registered element: ${orphans.join(", ")}`).toEqual([]);
  });

  it("keeps the catalog and the registry exactly in step", () => {
    expect([...catalogAwsCategoryIds].sort()).toEqual([...registeredAwsCategoryIds()].sort());
  });

  it("counts only categories, never boundaries, on the AWS half", () => {
    const awsCategoriesInIr = getIrSemanticTypes().filter(
      (value) => value.startsWith("aws-") && !isBoundarySemanticType(value),
    );
    expect([...awsCategoriesInIr].sort()).toEqual([...catalogAwsCategoryIds].sort());
  });

  it("does not admit GCP or Azure categories into the IR vocabulary", () => {
    const leaked = allElements()
      .filter((element) => element.family === "gcp" || element.family === "azure")
      .map((element) => element.id)
      .filter((id) => (getIrSemanticTypes() as readonly string[]).includes(id));
    expect(leaked).toEqual([]);
  });

  it("has no aws semanticType that is neither a category nor a boundary", () => {
    const known = new Set<string>([...catalogAwsCategoryIds, ...boundaryTypes]);
    const orphans = getIrSemanticTypes().filter(
      (value) => value.startsWith("aws-") && !known.has(value),
    );
    expect(orphans).toEqual([]);
  });
});

describe("TIER_BY_SEMANTIC_TYPE", () => {
  it("gives every semanticType a tier from the closed list", () => {
    for (const semanticType of getIrSemanticTypes()) {
      expect(isTier(TIER_BY_SEMANTIC_TYPE[semanticType]), `tier for ${semanticType}`).toBe(true);
    }
  });
});

describe("coerceTier", () => {
  it("keeps a tier the vocabulary accepts", () => {
    expect(coerceTier("data", "aws-compute")).toBe("data");
  });

  it("falls back to the documented default for the semanticType", () => {
    // "security" and "analytics" are the categories models reach for as tiers.
    expect(coerceTier("security", "aws-security")).toBe("compute");
    expect(coerceTier("analytics", "aws-analytics")).toBe("data");
    expect(coerceTier(undefined, "aws-iot")).toBe("edge");
  });

  it("normalizes rather than throwing for every semanticType", () => {
    for (const semanticType of getIrSemanticTypes() as readonly SemanticType[]) {
      expect(coerceTier("not-a-tier", semanticType)).toBe(TIER_BY_SEMANTIC_TYPE[semanticType]);
    }
  });
});
