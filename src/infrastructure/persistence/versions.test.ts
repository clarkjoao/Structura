import { describe, expect, it } from "vitest";
import {
  DIAGRAM_SCHEMA_VERSION,
  DIAGRAM_SCHEMA_URI,
  WORKSPACE_SCHEMA_VERSION,
  createVersionedDiagram,
  isVersionedDiagram,
} from "./versions";

describe("versions", () => {
  describe("constants", () => {
    it("should have valid schema versions", () => {
      expect(DIAGRAM_SCHEMA_VERSION).toBe(1);
      expect(WORKSPACE_SCHEMA_VERSION).toBe(2);
      expect(DIAGRAM_SCHEMA_URI).toBe("structura://diagrams/v1");
    });
  });

  describe("createVersionedDiagram", () => {
    it("should create a versioned diagram with correct structure", () => {
      const diagram = {
        id: "test-id",
        name: "Test Diagram",
        level: "context" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        snapshot: {
          components: {},
          connections: {},
          flows: {},
          iconLibrary: {},
        },
        nodeLayouts: {},
        edgeLayouts: {},
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      const versioned = createVersionedDiagram(diagram);

      expect(versioned.$schema).toBe(DIAGRAM_SCHEMA_URI);
      expect(versioned.schemaVersion).toBe(DIAGRAM_SCHEMA_VERSION);
      expect(versioned.data).toEqual(diagram);
      expect(versioned.exportedAt).toBeDefined();
    });
  });

  describe("isVersionedDiagram", () => {
    it("should return true for versioned diagrams", () => {
      const versioned = {
        $schema: DIAGRAM_SCHEMA_URI,
        schemaVersion: 1,
        data: { id: "test" },
      };

      expect(isVersionedDiagram(versioned)).toBe(true);
    });

    it("should return false for legacy diagrams", () => {
      const legacy = {
        id: "test",
        name: "Test",
        level: "context",
        snapshot: {},
        nodeLayouts: {},
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      expect(isVersionedDiagram(legacy)).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(isVersionedDiagram(null)).toBe(false);
      expect(isVersionedDiagram(undefined)).toBe(false);
    });

    it("should return false for non-objects", () => {
      expect(isVersionedDiagram("string")).toBe(false);
      expect(isVersionedDiagram(123)).toBe(false);
      expect(isVersionedDiagram([])).toBe(false);
    });
  });
});
