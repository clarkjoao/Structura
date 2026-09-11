import { describe, it, expect } from "vitest";
import { generateShareUrl, getShareParamFromUrl, decodeShareParam, getAppBaseUrl } from "./index";
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
    const originalHash = window.location.hash;
    window.location.hash = result.url.split("#")[1] || "";

    const shareParam = getShareParamFromUrl();
    expect(shareParam).toBeTruthy();

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
    const base64Encoded = btoa(JSON.stringify(testDiagram));
    const decoded = decodeShareParam(base64Encoded);
    expect(decoded).toBeTruthy();
    expect(decoded?.id).toBe(testDiagram.id);
  });

  it("carries the author's icon library so a shared node keeps its icon", () => {
    const icon = {
      id: "ico-1",
      name: "Box",
      source: { kind: "lucide" as const, iconName: "box" },
      createdAt: 0,
      usageCount: 1,
    };
    const withIcon: Diagram = {
      ...testDiagram,
      snapshot: {
        ...testDiagram.snapshot,
        components: {
          "comp-1": {
            id: "comp-1",
            type: "system",
            name: "API",
            description: "",
            parentId: null,
            customIconId: "ico-1",
          },
        },
        iconLibrary: { "ico-1": icon },
      },
    };
    const shareParam = generateShareUrl(withIcon).url.split("#share=")[1];
    const decoded = decodeShareParam(shareParam);

    expect(decoded?.snapshot.iconLibrary["ico-1"]).toEqual(icon);
    expect(decoded?.snapshot.components["comp-1"].customIconId).toBe("ico-1");
  });

  it("should return null for invalid share params", () => {
    expect(decodeShareParam("invalid-data")).toBeNull();
    expect(decodeShareParam("")).toBeNull();
    expect(decodeShareParam("x" + "=".repeat(100))).toBeNull();
  });
});

describe("getAppBaseUrl", () => {
  it("joins origin and the Vite base path without a trailing slash", () => {
    expect(getAppBaseUrl()).toBe(
      `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`,
    );
  });
});
