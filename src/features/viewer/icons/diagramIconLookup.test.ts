import { describe, expect, it } from "vitest";
import type { Component, Diagram, IconDefinition } from "@/features/diagram";
import { iconLookupForDiagram } from "./diagramIconLookup";

const lucideIcon = (id: string): IconDefinition => ({
  id,
  name: "Box",
  source: { kind: "lucide", iconName: "box" },
  createdAt: 0,
  usageCount: 1,
});

function diagramWithIcon(
  customIconId: string | undefined,
  library: Record<string, IconDefinition>,
): Diagram {
  const node = {
    id: "n1",
    name: "Svc",
    type: "system",
    description: "",
    parentId: null,
    customIconId,
  } as unknown as Component;
  return {
    id: "d1",
    name: "Viewed",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { n1: node },
      connections: {},
      flows: {},
      iconLibrary: library,
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("iconLookupForDiagram", () => {
  it("resolves a custom icon from the payload library", () => {
    const icon = lucideIcon("ico-1");
    const lookup = iconLookupForDiagram(diagramWithIcon("ico-1", { "ico-1": icon }));
    expect(lookup("n1")).toEqual(icon);
  });

  it("returns null when the component has no customIconId", () => {
    const lookup = iconLookupForDiagram(
      diagramWithIcon(undefined, { "ico-1": lucideIcon("ico-1") }),
    );
    expect(lookup("n1")).toBeNull();
  });

  it("returns null when the library does not hold that id", () => {
    const lookup = iconLookupForDiagram(diagramWithIcon("ico-missing", {}));
    expect(lookup("n1")).toBeNull();
  });
});
