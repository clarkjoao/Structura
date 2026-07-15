import { describe, expect, it } from "vitest";
import { validateDiagramFile } from "./validateWorkspaceFile";

describe("validateDiagramFile", () => {
  it("accepts valid diagram with numeric timestamps", () => {
    const validDiagram = {
      id: "test-id",
      name: "Test Diagram",
      level: "context",
      createdAt: 1783964207029, // number (milliseconds)
      updatedAt: 1783969008140, // number (milliseconds)
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

    const result = validateDiagramFile(validDiagram);
    expect(result.valid).toBe(true);
  });

  it("accepts valid diagram with string timestamps", () => {
    const validDiagram = {
      id: "test-id",
      name: "Test Diagram",
      level: "context",
      createdAt: "2024-01-15T10:30:00.000Z", // string (ISO date)
      updatedAt: "2024-01-16T12:00:00.000Z", // string (ISO date)
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

    const result = validateDiagramFile(validDiagram);
    expect(result.valid).toBe(true);
  });

  it("rejects diagram with invalid createdAt type", () => {
    const invalidDiagram = {
      id: "test-id",
      name: "Test Diagram",
      level: "context",
      createdAt: null,
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
    };

    const result = validateDiagramFile(invalidDiagram);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("createdAt");
  });

  it("rejects diagram with missing required fields", () => {
    const invalidDiagram = {
      id: "test-id",
      name: "Test Diagram",
      // missing level
      createdAt: 1783964207029,
      updatedAt: 1783969008140,
      snapshot: {
        components: {},
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const result = validateDiagramFile(invalidDiagram);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("level");
  });
});
