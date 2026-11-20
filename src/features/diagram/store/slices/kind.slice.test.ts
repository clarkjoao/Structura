import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "../test-utils";
import { PanelKind } from "../../enums";

function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("kind", "context", undefined, null, undefined, {
    kind: "stub-kind",
  });
  store.getState().openDiagram(diagram.id);
  return { store, diagramId: diagram.id };
}

function shape(store: ReturnType<typeof createTestDiagramStore>, id: string) {
  const d = store.getState().diagrams[id]!;
  const components = Object.values(d.snapshot.components)
    .map((c) => ({ type: c.type, name: c.name, parent: c.parentId === null ? null : "lane" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const connections = Object.values(d.snapshot.connections).map((c) => ({
    source: d.snapshot.components[c.sourceId]?.name,
    target: d.snapshot.components[c.targetId]?.name,
    label: c.label,
  }));
  return { components, connections };
}

describe("addDiagram with a kind", () => {
  it("stores a well-formed kind and leaves a malformed one freehand", () => {
    const store = createTestDiagramStore();
    expect(
      store.getState().addDiagram("a", "context", undefined, null, undefined, { kind: "guided" })
        .kind,
    ).toBe("guided");
    const freehand = store.getState().addDiagram("b", "context", undefined, null, undefined, {
      kind: "Bad Kind",
    });
    expect("kind" in freehand).toBe(false);
    expect("kind" in store.getState().addDiagram("c", "context")).toBe(false);
  });
});

describe("applyKindEdit", () => {
  it("writes the same graph a plugin applyChanges would", () => {
    const viaKind = seed();
    viaKind.store.getState().applyKindEdit({
      add: [
        {
          key: "lane",
          type: "panel",
          panelKind: PanelKind.Swimlane,
          name: "Lane",
          parent: null,
          x: 0,
          y: 0,
        },
        { key: "a", type: "system", name: "A", parent: "lane", x: 10, y: 10 },
        { key: "b", type: "system", name: "B", parent: "lane", x: 200, y: 10 },
      ],
      connect: [{ source: "a", target: "b", label: "data" }],
    });

    const viaPlugin = seed();
    viaPlugin.store.getState().applyGraphChanges({
      add: [
        {
          externalId: "lane",
          type: "panel",
          panelKind: PanelKind.Swimlane,
          name: "Lane",
          parentExternalId: null,
          x: 0,
          y: 0,
        },
        { externalId: "a", type: "system", name: "A", parentExternalId: "lane", x: 10, y: 10 },
        { externalId: "b", type: "system", name: "B", parentExternalId: "lane", x: 200, y: 10 },
      ],
      connect: [{ sourceExternalId: "a", targetExternalId: "b", label: "data" }],
    });

    expect(shape(viaKind.store, viaKind.diagramId)).toEqual(
      shape(viaPlugin.store, viaPlugin.diagramId),
    );
  });

  it("re-parents, re-wires, relabels and writes flows and kind data in one undo step", () => {
    const { store, diagramId } = seed();
    const created = store.getState().applyKindEdit({
      add: [
        {
          key: "l1",
          type: "panel",
          panelKind: PanelKind.Swimlane,
          name: "L1",
          parent: null,
          x: 0,
          y: 0,
        },
        {
          key: "l2",
          type: "panel",
          panelKind: PanelKind.Swimlane,
          name: "L2",
          parent: null,
          x: 0,
          y: 300,
        },
        {
          key: "a",
          type: "process-node",
          flowShape: "start",
          name: "A",
          parent: "l1",
          x: 10,
          y: 10,
        },
        { key: "b", type: "process-node", name: "B", parent: "l1", x: 200, y: 10 },
        { key: "c", type: "process-node", name: "C", parent: "l1", x: 400, y: 10 },
      ],
      connect: [{ source: "a", target: "b" }],
    });
    const ids = created.idsByKey;
    const connectionId = created.connectionIds[0]!;
    const before = store.getState().past.length;

    store.getState().applyKindEdit({
      reparent: [{ id: ids.b!, parent: ids.l2!, x: 20, y: 20 }],
      reconnect: [{ id: connectionId, target: ids.c! }],
      relabel: [{ id: connectionId, label: "order" }],
      update: [{ id: ids.c!, flowShape: "diamond" }],
      flows: {
        set: [{ id: "f", name: "F", mermaid: "", diagramId, steps: {} }],
      },
      kindData: { flowId: "f" },
    });

    const d = store.getState().diagrams[diagramId]!;
    expect(d.snapshot.components[ids.b!]!.parentId).toBe(ids.l2);
    expect(d.nodeLayouts[ids.b!]).toMatchObject({ x: 20, y: 20 });
    expect(d.snapshot.connections[connectionId]).toMatchObject({ targetId: ids.c, label: "order" });
    expect(d.snapshot.components[ids.c!]).toMatchObject({ flowShape: "diamond" });
    expect(d.snapshot.flows.f?.name).toBe("F");
    expect(d.kindData).toEqual({ flowId: "f" });
    expect(store.getState().past.length).toBe(before + 1);

    store.getState().undo();
    const undone = store.getState().diagrams[diagramId]!;
    expect(undone.snapshot.components[ids.b!]!.parentId).toBe(ids.l1);
    expect(undone.snapshot.flows.f).toBeUndefined();
    expect(undone.kindData).toBeUndefined();
  });

  it("amends the last checkpoint with history: false", () => {
    const { store } = seed();
    store.getState().applyKindEdit({
      add: [{ key: "a", type: "system", name: "A", parent: null, x: 0, y: 0 }],
    });
    const before = store.getState().past.length;
    store.getState().applyKindEdit({ kindData: { n: 1 } }, { history: false });
    expect(store.getState().past.length).toBe(before);
  });
});

describe("setKindMode", () => {
  it("switches to freehand and back as single undo steps, moving nothing", () => {
    const { store, diagramId } = seed();
    store.getState().applyKindEdit({
      add: [{ key: "a", type: "system", name: "A", parent: null, x: 5, y: 7 }],
    });
    const layoutsBefore = store.getState().diagrams[diagramId]!.nodeLayouts;
    const before = store.getState().past.length;

    store.getState().setKindMode(diagramId, "freehand");
    const d = store.getState().diagrams[diagramId]!;
    expect(d.kindMode).toBe("freehand");
    expect(d.nodeLayouts).toEqual(layoutsBefore);
    expect(store.getState().past.length).toBe(before + 1);

    store.getState().undo();
    expect(store.getState().diagrams[diagramId]!.kindMode).toBeUndefined();
    store.getState().redo();
    expect(store.getState().diagrams[diagramId]!.kindMode).toBe("freehand");
  });

  it("leaves a diagram without a kind alone", () => {
    const store = createTestDiagramStore();
    const d = store.getState().addDiagram("free", "context");
    store.getState().openDiagram(d.id);
    store.getState().setKindMode(d.id, "freehand");
    expect("kindMode" in store.getState().diagrams[d.id]!).toBe(false);
  });
});
