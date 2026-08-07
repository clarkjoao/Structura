import { describe, expect, it } from "vitest";
import { AWS_CATEGORIES } from "@/lib/catalogs/aws";
import {
  coerceTier,
  isBoundarySemanticType,
  isTier,
  IR_SEMANTIC_TYPES,
  TIER_BY_SEMANTIC_TYPE,
  type SemanticType,
} from "./ir.types";

const awsCategoryIds = AWS_CATEGORIES.map((category) => category.id);

/** `aws-*` semanticTypes that are IR concepts rather than catalog categories. */
const boundaryTypes = IR_SEMANTIC_TYPES.filter(isBoundarySemanticType);

describe("IR_SEMANTIC_TYPES", () => {
  // The prompt hands the model every service id in the catalog. A category with
  // no semanticType invites it to draw Athena and then rejects the whole diagram
  // over `nodeInvalidSemanticType`.
  it("has a semanticType for every AWS catalog category", () => {
    for (const categoryId of awsCategoryIds) {
      expect(IR_SEMANTIC_TYPES, `category ${categoryId}`).toContain(categoryId);
    }
  });

  it("has no aws semanticType that is neither a category nor a boundary", () => {
    const known = new Set<string>([...awsCategoryIds, ...boundaryTypes]);
    const orphans = IR_SEMANTIC_TYPES.filter(
      (value) => value.startsWith("aws-") && !known.has(value),
    );
    expect(orphans).toEqual([]);
  });
});

describe("TIER_BY_SEMANTIC_TYPE", () => {
  it("gives every semanticType a tier from the closed list", () => {
    for (const semanticType of IR_SEMANTIC_TYPES) {
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
    for (const semanticType of IR_SEMANTIC_TYPES satisfies readonly SemanticType[]) {
      expect(coerceTier("not-a-tier", semanticType)).toBe(TIER_BY_SEMANTIC_TYPE[semanticType]);
    }
  });
});
