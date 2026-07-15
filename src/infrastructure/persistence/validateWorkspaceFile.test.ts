import { describe, expect, it } from "vitest";
import { validateDiagramFile, validateManifest } from "./validateWorkspaceFile";
import { DIAGRAM_SCHEMA_URI } from "./versions";

function minimalDiagram(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id",
    name: "Test Diagram",
    level: "context",
    createdAt: 1783964207029,
    updatedAt: 1783969008140,
    snapshot: {
      components: {},
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

describe("validateDiagramFile", () => {
  describe("legacy format (no $schema)", () => {
    it("accepts valid diagram with numeric timestamps", () => {
      const result = validateDiagramFile(minimalDiagram());
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.diagram.id).toBe("test-id");
      }
    });

    it("accepts valid diagram with string timestamps", () => {
      const diagram = minimalDiagram({
        createdAt: "2024-01-15T10:30:00.000Z",
        updatedAt: "2024-01-16T12:00:00.000Z",
      });
      const result = validateDiagramFile(diagram);
      expect(result.valid).toBe(true);
    });

    it("rejects diagram with invalid createdAt type", () => {
      const result = validateDiagramFile(minimalDiagram({ createdAt: null }));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("createdAt");
    });

    it("rejects diagram with missing required fields", () => {
      const result = validateDiagramFile({ id: "test" });
      expect(result.valid).toBe(false);
    });

    it("rejects tombstone files", () => {
      const result = validateDiagramFile({ deleted: true, id: "test" });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("tombstone");
    });
  });

  describe("versioned format (with $schema)", () => {
    it("accepts valid versioned diagram", () => {
      const versioned = {
        $schema: DIAGRAM_SCHEMA_URI,
        schemaVersion: 1,
        data: minimalDiagram(),
      };
      const result = validateDiagramFile(versioned);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.diagram.id).toBe("test-id");
      }
    });

    it("accepts versioned diagram with older schema version", () => {
      const versioned = {
        $schema: DIAGRAM_SCHEMA_URI,
        schemaVersion: 0,
        data: minimalDiagram(),
      };
      const result = validateDiagramFile(versioned);
      expect(result.valid).toBe(true);
    });

    it("rejects versioned diagram with future schema version", () => {
      const versioned = {
        $schema: DIAGRAM_SCHEMA_URI,
        schemaVersion: 999,
        data: minimalDiagram(),
      };
      const result = validateDiagramFile(versioned);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Unsupported");
    });

    it("rejects versioned diagram with invalid data", () => {
      const versioned = {
        $schema: DIAGRAM_SCHEMA_URI,
        schemaVersion: 1,
        data: { id: "test" }, // missing required fields
      };
      const result = validateDiagramFile(versioned);
      expect(result.valid).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects null input", () => {
      const result = validateDiagramFile(null);
      expect(result.valid).toBe(false);
    });

    it("rejects undefined input", () => {
      const result = validateDiagramFile(undefined);
      expect(result.valid).toBe(false);
    });

    it("rejects non-object input", () => {
      expect(validateDiagramFile("string").valid).toBe(false);
      expect(validateDiagramFile(123).valid).toBe(false);
    });

    it("rejects empty object", () => {
      const result = validateDiagramFile({});
      expect(result.valid).toBe(false);
    });
  });
});

describe("validateManifest", () => {
  it("accepts manifest version 1 (legacy)", () => {
    const manifest = {
      version: 1,
      diagramIds: ["d1", "d2"],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
  });

  it("accepts manifest version 2 (new)", () => {
    const manifest = {
      version: 2,
      diagramIds: ["d1", "d2"],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
  });

  it("rejects manifest with invalid version", () => {
    const manifest = {
      version: 3,
      diagramIds: [],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid manifest version");
  });

  it("rejects manifest with missing diagramIds", () => {
    const manifest = {
      version: 1,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("diagramIds");
  });
});
