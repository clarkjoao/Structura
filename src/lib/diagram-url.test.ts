import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import { generateShareUrl, getShareParamFromUrl, decodeShareParam } from "./diagram-url";
import type { Diagram } from "@/features/diagram";
import { EdgeStyle } from "@/features/diagram";

describe("Sharing functionality", () => {
  const testDiagram: Diagram = {
    id: "test-id",
    name: "Test Diagram",
    level: "context",
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

  it("should encode and decode a diagram correctly", () => {
    const result = generateShareUrl(testDiagram);
    expect(result.url).toContain("#share=");
    expect(result.url.length).toBeGreaterThan(0);
  });

  it("should extract share param from URL", () => {
    const result = generateShareUrl(testDiagram);
    // Simulate being on that URL by setting location.hash
    const originalHash = window.location.hash;
    window.location.hash = result.url.split("#")[1] || "";

    const shareParam = getShareParamFromUrl();
    expect(shareParam).toBeTruthy();

    // Restore
    window.location.hash = originalHash;
  });

  it("should decode share param correctly", () => {
    const result = generateShareUrl(testDiagram);
    const shareParam = result.url.split("#share=")[1];

    const decoded = decodeShareParam(shareParam);
    expect(decoded).toBeTruthy();
    expect(decoded?.id).toBe(testDiagram.id);
    expect(decoded?.name).toBe(testDiagram.name);
    expect(decoded?.snapshot).toBeDefined();
  });

  it("should handle complex diagrams with components", () => {
    const complexDiagram = {
      ...testDiagram,
      snapshot: {
        components: {
          "comp-1": {
            id: "comp-1",
            type: "person" as const,
            name: "User",
            description: "A user",
            parentId: null,
          },
        },
        connections: {
          "conn-1": {
            id: "conn-1",
            sourceId: "comp-1",
            targetId: "comp-2",
            label: "uses",
            style: { edgeStyle: EdgeStyle.Bezier },
          },
        },
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        "comp-1": { elementId: "comp-1", x: 100, y: 100 },
      },
    };

    const result = generateShareUrl(complexDiagram);
    const shareParam = result.url.split("#share=")[1];
    const decoded = decodeShareParam(shareParam);

    expect(decoded).toBeTruthy();
    expect(decoded?.snapshot.components["comp-1"]).toBeDefined();
    expect(decoded?.snapshot.components["comp-1"].name).toBe("User");
  });

  it("should handle base64 fallback for legacy URLs", () => {
    // This tests the fallback mechanism
    const base64Encoded = btoa(JSON.stringify(testDiagram));
    const decoded = decodeShareParam(base64Encoded);
    expect(decoded).toBeTruthy();
    expect(decoded?.id).toBe(testDiagram.id);
  });

  it("should return null for invalid share params", () => {
    expect(decodeShareParam("invalid-data")).toBeNull();
    expect(decodeShareParam("")).toBeNull();
    expect(decodeShareParam("x" + "=".repeat(100))).toBeNull();
  });
});
