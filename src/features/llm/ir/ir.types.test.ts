import { describe, expect, it } from "vitest";
import { allElements } from "@/features/elements/element.registry";
import {
  coerceTier,
  getIrSemanticTypes,
  irAwsCategoryIdsFromRegistry,
  isBoundarySemanticType,
  isTier,
  TIER_BY_SEMANTIC_TYPE,
  type SemanticType,
} from "./ir.types";

const registeredAwsCategoryIds = irAwsCategoryIdsFromRegistry();

/** `aws-*` semanticTypes that are IR concepts rather than catalog categories. */
const boundaryTypes = getIrSemanticTypes().filter(isBoundarySemanticType);

describe("getIrSemanticTypes (registry-backed AWS categories)", () => {
  // The prompt hands the model every service id for registered AWS categories.
  // A category with no semanticType invites it to draw Athena and then rejects
  // the whole diagram over `nodeInvalidSemanticType`.
  it("has a semanticType for every registered AWS category", () => {
    expect(registeredAwsCategoryIds.length).toBeGreaterThan(0);
    for (const categoryId of registeredAwsCategoryIds) {
      expect(getIrSemanticTypes(), `category ${categoryId}`).toContain(categoryId);
    }
  });

  it("AWS category half equals the registered AWS family only", () => {
    const awsCategoriesInIr = getIrSemanticTypes().filter(
      (value) => value.startsWith("aws-") && !isBoundarySemanticType(value),
    );
    expect([...awsCategoriesInIr].sort()).toEqual([...registeredAwsCategoryIds].sort());
  });

  it("does not admit GCP or Azure categories into the IR vocabulary", () => {
    const leaked = allElements()
      .filter((element) => element.family === "gcp" || element.family === "azure")
      .map((element) => element.id)
      .filter((id) => (getIrSemanticTypes() as readonly string[]).includes(id));
    expect(leaked).toEqual([]);
  });

  it("has no aws semanticType that is neither a category nor a boundary", () => {
    const known = new Set<string>([...registeredAwsCategoryIds, ...boundaryTypes]);
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

describe("getIrSemanticTypes is live (not a load-time snapshot)", () => {
  it("includes aws-compute after registry bootstrap", () => {
    // Guards the Cypress production failure: a chunk-local empty registry
    // snapshot rejected every category semanticType while vitest passed.
    expect(getIrSemanticTypes()).toContain("aws-compute");
    expect(getIrSemanticTypes()).toContain("aws-networking");
    expect(getIrSemanticTypes()).toContain("aws-database");
  });
});
