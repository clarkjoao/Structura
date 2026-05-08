import { describe, expect, it } from "vitest";
import type { PatternTemplate } from "@/lib/catalogs/patterns";
import { createTestDiagramStore } from "../test-utils";

describe("insertPattern", () => {
  const minimalTemplate: PatternTemplate = {
    id: "test-pattern",
    name: "Test",
    description: "d",
    category: "api",
    components: [
      { type: "system", name: "A", description: "" },
      { type: "system", name: "B", description: "" },
    ],
    connections: [{ fromIndex: 0, toIndex: 1, label: "link" }],
  };

  it("returns string IDs with length equal to template.components.length", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("P", "context");
    store.getState().openDiagram(diagram.id);

    const ids = store.getState().insertPattern(minimalTemplate, { x: 0, y: 0 });

    expect(ids).toHaveLength(minimalTemplate.components.length);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("returned IDs match component IDs on the diagram snapshot", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("P2", "context");
    store.getState().openDiagram(diagram.id);

    const ids = store.getState().insertPattern(minimalTemplate, { x: 10, y: 20 });
    const snapshot = store.getState().diagrams[diagram.id]!.snapshot;

    for (const id of ids) {
      expect(snapshot.components[id]).toBeDefined();
      expect(snapshot.components[id]!.id).toBe(id);
    }
    expect(Object.keys(snapshot.connections)).toHaveLength(1);
  });

  it("returns empty array when no diagram is active", () => {
    const store = createTestDiagramStore();
    store.getState().addDiagram("Orphan", "context");

    const ids = store.getState().insertPattern(minimalTemplate, { x: 0, y: 0 });

    expect(ids).toEqual([]);
  });
});
