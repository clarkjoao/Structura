import { describe, expect, it } from "vitest";
import { sanitizeComponentType } from "./sanitize-component-type";

describe("sanitizeComponentType (F9)", () => {
  it("keeps registered element ids", () => {
    expect(sanitizeComponentType("person")).toBe("person");
    expect(sanitizeComponentType("aws-compute")).toBe("aws-compute");
    expect(sanitizeComponentType("panel")).toBe("panel");
  });

  it("keeps plugin-namespaced types", () => {
    expect(sanitizeComponentType("leanix/factsheet")).toBe("leanix/factsheet");
  });

  it("falls back to unknown for corrupted non-cloud types", () => {
    expect(sanitizeComponentType("API Endpoints /api/v1 · REST")).toBe("unknown");
    expect(sanitizeComponentType("")).toBe("unknown");
    expect(sanitizeComponentType(null)).toBe("unknown");
  });

  it("recovers an unknown cloud category to the family general bucket", () => {
    expect(sanitizeComponentType("aws-does-not-exist")).toBe("aws-general");
    expect(sanitizeComponentType("gcp-legacy-category")).toBe("gcp-general");
    expect(sanitizeComponentType("azure-retired-thing")).toBe("azure-general");
  });
});
