import { describe, expect, it } from "vitest";
import type { Diagram, SceneDiff } from "@/features/diagram";
import { ExternalLinkType } from "@/features/diagram";
import { serializeDiagramContext } from "./serializer";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    id: "d1",
    name: "Proj",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

describe("serializeDiagramContext", () => {
  it("serializes an empty diagram without errors", () => {
    const out = serializeDiagramContext(minimalDiagram());
    expect(out).toContain("Diagram: Proj");
    expect(out).toContain("Nodes (0)");
    expect(out).toContain("Connections (0)");
  });

  it("includes id, type, name, and parent for each node", () => {
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
    expect(out).toContain('id=n1; type=system; name="Alpha"');
    expect(out).toContain('id=n2; type=container; name="Beta"; parent=n1');
  });

  it("includes id, from, to, and label for each edge", () => {
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
    expect(out).toContain('id=e1; from=a; to=b; label="calls"');
  });

  it("includes Description when includeMetadata is true", () => {
    const diagram = minimalDiagram({ description: "About" });
    const out = serializeDiagramContext(diagram, { includeMetadata: true });
    expect(out).toContain("Description: About");
  });

  it("omits Description when includeMetadata is false", () => {
    const diagram = minimalDiagram({ description: "Secret" });
    const out = serializeDiagramContext(diagram, { includeMetadata: false });
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
    expect(out).toContain("External Links:");
    expect(out).toContain("- Docs: https://example.com");
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

  it("uses component id as name when name is empty or whitespace", () => {
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
    expect(out).toContain('name="x"');
  });
});

describe("serializeDiagramContext with activeScene", () => {
  it("omits Active Scene section when activeScene is undefined", () => {
    const out = serializeDiagramContext(minimalDiagram());
    expect(out).not.toContain("Active Scene");
  });

  it("includes Active Scene name", () => {
    const scene: SceneDiff = {
      id: "s1",
      name: "Physical View",
      color: "#000",
      createdAt: 0,
      addedComponents: {},
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    const out = serializeDiagramContext(minimalDiagram(), { activeScene: scene });
    expect(out).toContain('Active Scene: "Physical View"');
  });

  it("lists added components in the scene", () => {
    const scene: SceneDiff = {
      id: "s1",
      name: "S",
      color: "",
      createdAt: 0,
      addedComponents: {
        n1: {
          id: "n1",
          name: "Lambda",
          type: "aws-compute",
          description: "",
          parentId: null,
        },
      },
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    const out = serializeDiagramContext(minimalDiagram(), { activeScene: scene });
    expect(out).toContain("Added in scene: Lambda");
  });

  it("lists removed component ids in the scene", () => {
    const scene: SceneDiff = {
      id: "s1",
      name: "S",
      color: "",
      createdAt: 0,
      addedComponents: {},
      addedConnections: {},
      removedComponentIds: ["old-node"],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    const out = serializeDiagramContext(minimalDiagram(), { activeScene: scene });
    expect(out).toContain("Removed in scene: old-node");
  });

  it("lists added connections in the scene", () => {
    const scene: SceneDiff = {
      id: "s1",
      name: "S",
      color: "",
      createdAt: 0,
      addedComponents: {},
      addedConnections: {
        e1: { id: "e1", sourceId: "a", targetId: "b", label: "calls" },
      },
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    const out = serializeDiagramContext(minimalDiagram(), { activeScene: scene });
    expect(out).toContain("Edges added in this scene (1)");
    expect(out).toContain("id=e1; source=a; target=b; label=calls");
  });

  it("output remains deterministic with activeScene", () => {
    const scene: SceneDiff = {
      id: "s1",
      name: "S",
      color: "",
      createdAt: 0,
      addedComponents: {
        n1: { id: "n1", name: "X", type: "system", description: "", parentId: null },
      },
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    const first = serializeDiagramContext(minimalDiagram(), { activeScene: scene });
    const second = serializeDiagramContext(minimalDiagram(), { activeScene: scene });
    expect(first).toBe(second);
  });
});
