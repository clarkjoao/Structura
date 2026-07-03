import { describe, expect, it } from "vitest";
import { validatePluginManifest } from "./manifest-validation";

const validManifest = {
  id: "structura-plugin-example",
  name: "Example",
  version: "1.0.0",
  author: "Someone",
  description: "An example plugin",
  apiVersion: "^1.0",
  capabilities: ["io:importers"],
};

describe("validatePluginManifest", () => {
  it("accepts a valid manifest", () => {
    const result = validatePluginManifest(validManifest, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.id).toBe("structura-plugin-example");
      expect(result.manifest.capabilities).toEqual(["io:importers"]);
    }
  });

  it("rejects non-object candidates", () => {
    for (const candidate of [null, "manifest", 42, ["id"]]) {
      const result = validatePluginManifest(candidate, []);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe("not-an-object");
    }
  });

  it("reports each missing required field", () => {
    const result = validatePluginManifest({ id: "x", capabilities: [] }, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const missing = result.errors
        .filter((e) => e.code === "missing-field")
        .map((e) => e.field)
        .sort();
      expect(missing).toEqual(["apiVersion", "author", "description", "name", "version"]);
    }
  });

  it("rejects an invalid plugin version", () => {
    const result = validatePluginManifest({ ...validManifest, version: "1.0" }, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: "invalid-semver",
        field: "version",
        detail: "1.0",
      });
    }
  });

  it("rejects an incompatible apiVersion range (spec scenario)", () => {
    const result = validatePluginManifest({ ...validManifest, apiVersion: "^9.0" }, [], "1.0.0");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: "incompatible-api-version",
        field: "apiVersion",
        detail: "^9.0",
      });
    }
  });

  it("rejects unknown capabilities", () => {
    const result = validatePluginManifest(
      { ...validManifest, capabilities: ["io:importers", "filesystem"] },
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: "unknown-capability",
        field: "capabilities",
        detail: "filesystem",
      });
    }
  });

  it("rejects a duplicate id against installed plugins (spec scenario)", () => {
    const result = validatePluginManifest(validManifest, ["structura-plugin-example"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        code: "duplicate-id",
        field: "id",
        detail: "structura-plugin-example",
      });
    }
  });

  it("preserves the optional entry field", () => {
    const result = validatePluginManifest({ ...validManifest, entry: "dist/index.js" }, []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.entry).toBe("dist/index.js");
  });
});
