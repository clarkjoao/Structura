import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { ExternalLinkType } from "@/features/diagram";
import { serializeDiagramContext } from "./serializer";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    id: "d1",
    name: "Proj",
    level: "context",
    createdAt: "",
    updatedAt: "",
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

describe("serializeDiagramContext", () => {
  it("serializes an empty diagram without errors", () => {
    const out = serializeDiagramContext(minimalDiagram());
    expect(out).toContain("Diagram: Proj");
    expect(out).toContain("Nodes (0)");
    expect(out).toContain("Edges (0)");
  });

  it("includes id, type, label, and parent for each node", () => {
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          n2: {
            id: "n2",
            name: "Beta",
            type: "container",
            description: "",
            parentId: "n1",
          },
          n1: {
            id: "n1",
            name: "Alpha",
            type: "system",
            description: "",
            parentId: null,
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
    });
    const out = serializeDiagramContext(diagram);
    expect(out).toContain("id=n1; type=system; label=Alpha; parent=none");
    expect(out).toContain("id=n2; type=container; label=Beta; parent=n1");
  });

  it("includes id, source, target, and label for each edge", () => {
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          a: { id: "a", name: "A", type: "system", description: "", parentId: null },
          b: { id: "b", name: "B", type: "system", description: "", parentId: null },
        },
        connections: {
          e1: { id: "e1", sourceId: "a", targetId: "b", label: "calls" },
        },
        flows: {},
        iconLibrary: {},
      },
    });
    const out = serializeDiagramContext(diagram);
    expect(out).toContain("id=e1; source=a; target=b; label=calls");
  });

  it("includes Project and Description when includeMetadata is true", () => {
    const diagram = minimalDiagram({ description: "About" });
    const out = serializeDiagramContext(diagram, { includeMetadata: true });
    expect(out).toContain("Project: Proj");
    expect(out).toContain("Description: About");
  });

  it("omits Project and Description when includeMetadata is false", () => {
    const diagram = minimalDiagram({ description: "Secret" });
    const out = serializeDiagramContext(diagram, { includeMetadata: false });
    expect(out).not.toContain("Project:");
    expect(out).not.toContain("Description:");
  });

  it("includes external links when includeLinks is true", () => {
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          n1: {
            id: "n1",
            name: "N",
            type: "system",
            description: "",
            parentId: null,
            externalLinks: [
              { id: "l1", label: "Docs", url: "https://example.com", type: ExternalLinkType.Generic },
            ],
          },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
    });
    const out = serializeDiagramContext(diagram, { includeLinks: true });
    expect(out).toContain("External Links (1)");
    expect(out).toContain("label=Docs url=https://example.com");
  });

  it("produces deterministic output for the same diagram", () => {
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          z: { id: "z", name: "Z", type: "system", description: "", parentId: null },
          a: { id: "a", name: "A", type: "system", description: "", parentId: null },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
    });
    const first = serializeDiagramContext(diagram);
    const second = serializeDiagramContext(diagram);
    expect(first).toBe(second);
    const aIndex = first.indexOf("id=a");
    const zIndex = first.indexOf("id=z");
    expect(aIndex).toBeLessThan(zIndex);
  });

  it("uses component id as label when name is empty or whitespace", () => {
    const diagram = minimalDiagram({
      snapshot: {
        components: {
          x: { id: "x", name: "   ", type: "system", description: "", parentId: null },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
    });
    const out = serializeDiagramContext(diagram);
    expect(out).toContain("label=x");
  });
});
