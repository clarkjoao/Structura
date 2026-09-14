import { describe, expect, it } from "vitest";
import type { ComponentType } from "../../model";
import { COMPONENT_TYPE_DB_TABLE, COMPONENT_TYPE_JSON_VIEWER } from "../../model";
import { canBeConnectionSource } from "../../model/connection-rules";
import { createTestDiagramStore } from "../test-utils";
import type { GeneratedEdgeInput, GeneratedNodeInput } from "./generated-graph.slice";

/**
 * A connection cannot leave a note, a JSON viewer or a db-table.
 *
 * These are things a diagram points *at*: the arrow runs from whatever is
 * being described to them, and never back out. The canvas has always drawn
 * them that way — they render an incoming handle and no outgoing one — but
 * nothing stopped a connection being created with one as its source. The
 * canvas could not draw it (React Flow refuses an edge whose handle is
 * missing, error #008) so it vanished with a console warning, and the
 * connection stayed in the store forever, in exports and in flows.
 *
 * The UI cannot produce one: with no source handle there is nothing to start
 * a drag from. Every path that can is a path that bypasses the handles —
 * quick insert from a selected node, a generated graph, an LLM patch, a
 * scene — so the rule belongs in the store, which is the one place all of
 * them go through.
 */

const SOURCELESS = ["note", COMPONENT_TYPE_DB_TABLE, COMPONENT_TYPE_JSON_VIEWER];

function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("rule", "container");
  store.getState().openDiagram(diagram.id);
  return { store, diagramId: diagram.id };
}

function connectionsOf(store: ReturnType<typeof createTestDiagramStore>, diagramId: string) {
  return store.getState().diagrams[diagramId]!.snapshot.connections;
}

describe("canBeConnectionSource", () => {
  it.each(SOURCELESS)("says no for %s", (type) => {
    expect(canBeConnectionSource(type)).toBe(false);
  });

  it.each(["system", "container", "person", "component", "panel", "endpoint", "svg"])(
    "says yes for %s",
    (type) => {
      expect(canBeConnectionSource(type)).toBe(true);
    },
  );
});

describe("addConnection", () => {
  it.each(SOURCELESS)("refuses a %s as the source and creates nothing", (type) => {
    const { store, diagramId } = seed();
    const note = store.getState().addComponent(type as ComponentType, "note", null);
    const target = store.getState().addComponent("system", "svc", null);

    const created = store.getState().addConnection(note.id, target.id, "uses");

    expect(created).toBeNull();
    expect(Object.keys(connectionsOf(store, diagramId))).toHaveLength(0);
  });

  it.each(SOURCELESS)("still accepts a %s as the target", (type) => {
    const { store, diagramId } = seed();
    const source = store.getState().addComponent("system", "svc", null);
    const note = store.getState().addComponent(type as ComponentType, "note", null);

    const created = store.getState().addConnection(source.id, note.id, "describes");

    expect(created).not.toBeNull();
    expect(Object.keys(connectionsOf(store, diagramId))).toHaveLength(1);
  });
});

describe("updateConnection", () => {
  it("refuses to repoint an existing connection's source at a note", () => {
    const { store, diagramId } = seed();
    const a = store.getState().addComponent("system", "a", null);
    const b = store.getState().addComponent("system", "b", null);
    const note = store.getState().addComponent("note", "n", null);
    const created = store.getState().addConnection(a.id, b.id, "uses")!;

    store.getState().updateConnection(created.id, { sourceId: note.id });

    expect(connectionsOf(store, diagramId)[created.id]!.sourceId).toBe(a.id);
  });

  it("still applies a patch that leaves the source alone", () => {
    const { store, diagramId } = seed();
    const a = store.getState().addComponent("system", "a", null);
    const b = store.getState().addComponent("system", "b", null);
    const created = store.getState().addConnection(a.id, b.id, "uses")!;

    store.getState().updateConnection(created.id, { label: "calls" });

    expect(connectionsOf(store, diagramId)[created.id]!.label).toBe("calls");
  });
});

describe("insertGeneratedGraph", () => {
  /**
   * The generation path is the one that actually produced these in practice:
   * a model asked for an edge out of a note and the graph went in whole.
   */
  it("drops a generated edge that leaves a note, and keeps the rest", () => {
    const { store, diagramId } = seed();
    const nodes: GeneratedNodeInput[] = [
      { externalId: "n", type: "note", name: "Note", parentExternalId: null, x: 0, y: 0 },
      { externalId: "a", type: "system", name: "A", parentExternalId: null, x: 0, y: 0 },
      { externalId: "b", type: "system", name: "B", parentExternalId: null, x: 0, y: 0 },
    ];
    const edges: GeneratedEdgeInput[] = [
      { sourceExternalId: "n", targetExternalId: "a", label: "from the note" },
      { sourceExternalId: "a", targetExternalId: "b", label: "kept" },
      { sourceExternalId: "b", targetExternalId: "n", label: "into the note" },
    ];

    store.getState().insertGeneratedGraph(nodes, edges);

    const labels = Object.values(connectionsOf(store, diagramId)).map((c) => c.label);
    expect(labels.sort()).toEqual(["into the note", "kept"]);
  });
});
