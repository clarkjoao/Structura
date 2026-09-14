import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { duplicateSelection } from "./duplicateSelection";

function asNodes(ids: string[]): Node[] {
  return ids.map((id) => ({ id, position: { x: 0, y: 0 }, data: {} }));
}

describe("duplicateSelection", () => {
  it("preserves tags, description, and technology on the copy", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Dup", "context");
    store.getState().openDiagram(diagram.id);

    const original = store.getState().addComponent("system", "API Gateway", null, {
      x: 100,
      y: 100,
    });
    store.getState().updateComponent(original.id, {
      tags: ["edge", "public"],
      description: "Entry point",
      technology: "Kong",
    });

    const active = store.getState().diagrams[store.getState().activeDiagramId!];
    const newIds = duplicateSelection({
      diagram: active,
      nodes: asNodes([original.id]),
      copyToClipboard: (ids) => store.getState().copyToClipboard(ids),
      pasteFromClipboard: (position, options) =>
        store.getState().pasteFromClipboard(position, options),
    });

    expect(newIds).toHaveLength(1);
    const copy =
      store.getState().diagrams[store.getState().activeDiagramId!].snapshot.components[newIds[0]];
    expect(copy.id).not.toBe(original.id);
    expect(copy.tags).toEqual(["edge", "public"]);
    expect(copy.description).toBe("Entry point");
    expect("technology" in copy && copy.technology).toBe("Kong");
  });

  it("keeps parent when duplicating siblings inside the same panel", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Dup", "context");
    store.getState().openDiagram(diagram.id);

    const panel = store.getState().addComponent("panel", "Zone", null, { x: 0, y: 0 });
    const childA = store.getState().addComponent("container", "A", panel.id, { x: 40, y: 40 });
    const childB = store.getState().addComponent("container", "B", panel.id, { x: 80, y: 80 });
    store.getState().updateComponent(childA.id, { tags: ["keep"] });

    const active = store.getState().diagrams[store.getState().activeDiagramId!];
    const newIds = duplicateSelection({
      diagram: active,
      nodes: asNodes([childA.id, childB.id]),
      copyToClipboard: (ids) => store.getState().copyToClipboard(ids),
      pasteFromClipboard: (position, options) =>
        store.getState().pasteFromClipboard(position, options),
    });

    expect(newIds.length).toBeGreaterThanOrEqual(2);
    const after = store.getState().diagrams[store.getState().activeDiagramId!];
    for (const id of newIds) {
      expect(after.snapshot.components[id].parentId).toBe(panel.id);
    }
    const taggedCopy = newIds
      .map((id) => after.snapshot.components[id])
      .find((component) => component.tags?.includes("keep"));
    expect(taggedCopy).toBeDefined();
  });
});
