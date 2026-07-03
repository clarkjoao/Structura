import { describe, expect, it } from "vitest";
import { isValidSemver, isValidSemverRange, parseSemver, semverSatisfies } from "./semver";

describe("parseSemver", () => {
  it("parses a full triple", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("rejects partial and malformed versions", () => {
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("1.2.3-beta")).toBeNull();
    expect(parseSemver("v1.2.3")).toBeNull();
    expect(parseSemver("")).toBeNull();
    expect(isValidSemver("1.0.0")).toBe(true);
    expect(isValidSemver("^1.0.0")).toBe(false);
  });
});

describe("isValidSemverRange", () => {
  it("accepts supported range forms", () => {
    for (const range of ["1.2.3", "^1.0", "^1.2.3", "~1.2", "1", "1.x", "*"]) {
      expect(isValidSemverRange(range)).toBe(true);
    }
  });

  it("rejects unsupported forms", () => {
    for (const range of [">=1.0.0", "1.0.0 - 2.0.0", "^1 || ^2", "abc"]) {
      expect(isValidSemverRange(range)).toBe(false);
    }
  });
});

describe("semverSatisfies", () => {
  it("matches exact versions", () => {
    expect(semverSatisfies("1.2.3", "1.2.3")).toBe(true);
    expect(semverSatisfies("1.2.4", "1.2.3")).toBe(false);
  });

  it("handles caret ranges", () => {
    expect(semverSatisfies("1.0.0", "^1.0")).toBe(true);
    expect(semverSatisfies("1.9.9", "^1.0")).toBe(true);
    expect(semverSatisfies("2.0.0", "^1.0")).toBe(false);
    expect(semverSatisfies("1.1.9", "^1.2.3")).toBe(false);
    expect(semverSatisfies("1.2.3", "^1.2.3")).toBe(true);
  });

  it("pins the minor for ^0.x", () => {
    expect(semverSatisfies("0.2.5", "^0.2.1")).toBe(true);
    expect(semverSatisfies("0.3.0", "^0.2.1")).toBe(false);
    expect(semverSatisfies("0.9.0", "^0")).toBe(true);
  });

  it("handles tilde ranges", () => {
    expect(semverSatisfies("1.2.9", "~1.2.3")).toBe(true);
    expect(semverSatisfies("1.3.0", "~1.2.3")).toBe(false);
    expect(semverSatisfies("1.2.0", "~1.2.3")).toBe(false);
  });

  it("handles wildcards and bare majors", () => {
    expect(semverSatisfies("3.1.4", "*")).toBe(true);
    expect(semverSatisfies("1.5.0", "1")).toBe(true);
    expect(semverSatisfies("1.5.0", "1.x")).toBe(true);
    expect(semverSatisfies("2.0.0", "1.x")).toBe(false);
    expect(semverSatisfies("1.5.0", "1.5")).toBe(true);
    expect(semverSatisfies("1.6.0", "1.5")).toBe(false);
  });

  it("rejects the incompatible-API scenario from the spec", () => {
    // Spec scenario: manifest apiVersion "^9.0" against a 1.x API.
    expect(semverSatisfies("1.0.0", "^9.0")).toBe(false);
  });
});
