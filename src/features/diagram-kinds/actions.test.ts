import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerDiagramKind, unregisterDiagramKind } from "./registry";
import { createKindDiagram, editKindFreehand, mergeKindEdits, returnToKind } from "./actions";
import type { DiagramKindDescriptor } from "./kind.types";

/** Conforms while no component is named "bad"; derives a flow named after the count. */
const stub: DiagramKindDescriptor = {
  id: "stub-round-trip",
  label: { text: "Stub" },
  returnLabel: { text: "Back to stub" },
  creatable: true,
  elements: [],
  interaction: {
    nodesDraggable: false,
    resizable: false,
    arrangeModeChoice: false,
    recordFlows: false,
  },
  create: () => ({
    edit: { add: [{ key: "start", type: "system", name: "Start", parent: null, x: 0, y: 0 }] },
    select: "start",
  }),
  conforms: (diagram) =>
    Object.values(diagram.snapshot.components)
      .filter((c) => c.name === "bad")
      .map((c) => ({ code: "bad", elementId: c.id, message: { text: "Bad element" } })),
  derive: (diagram) => {
    const name = `count:${Object.keys(diagram.snapshot.components).length}`;
    if (diagram.snapshot.flows.derived?.name === name) return null;
    return {
      flows: { set: [{ id: "derived", name, mermaid: "", diagramId: diagram.id, steps: {} }] },
    };
  },
};

beforeAll(() => registerDiagramKind(stub));
afterAll(() => unregisterDiagramKind(stub.id));
beforeEach(() => useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 }));

function create() {
  const { diagram, selectId } = createKindDiagram({
    name: `Round trip ${Math.random()}`,
    level: "context",
    kindId: stub.id,
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  return { diagramId: diagram.id, selectId };
}

describe("createKindDiagram", () => {
  it("applies the creation template and derivation, and names the element to select", () => {
    const { diagramId, selectId } = create();
    const d = useDiagramStore.getState().diagrams[diagramId]!;
    expect(d.kind).toBe(stub.id);
    expect(d.snapshot.components[selectId!]?.name).toBe("Start");
    expect(d.snapshot.flows.derived?.name).toBe("count:1");
  });

  it("creates a freehand diagram for no kind or an unknown one", () => {
    for (const kindId of [null, "not-registered"]) {
      const { diagram } = createKindDiagram({ name: "Free", level: "context", kindId });
      expect("kind" in diagram).toBe(false);
    }
  });
});

describe("round trip", () => {
  it("returns to the kind when it conforms, re-deriving in one undo step", () => {
    const { diagramId } = create();
    editKindFreehand(diagramId);
    expect(useDiagramStore.getState().diagrams[diagramId]!.kindMode).toBe("freehand");
    useDiagramStore.getState().addComponent("system", "Added freehand", null, { x: 9, y: 9 });
    const before = useDiagramStore.getState().past.length;

    expect(returnToKind(diagramId)).toEqual({ ok: true });
    const d = useDiagramStore.getState().diagrams[diagramId]!;
    expect(d.kindMode).toBeUndefined();
    expect(d.snapshot.flows.derived?.name).toBe("count:2");
    expect(useDiagramStore.getState().past.length).toBe(before + 1);

    useDiagramStore.getState().undo();
    const undone = useDiagramStore.getState().diagrams[diagramId]!;
    expect(undone.kindMode).toBe("freehand");
    expect(undone.snapshot.flows.derived?.name).toBe("count:1");
  });

  it("stays freehand and lists the issues when it does not conform", () => {
    const { diagramId } = create();
    editKindFreehand(diagramId);
    const bad = useDiagramStore.getState().addComponent("system", "bad", null, { x: 0, y: 0 });
    const before = useDiagramStore.getState().past.length;

    const result = returnToKind(diagramId);
    expect(result).toMatchObject({ ok: false, reason: "issues" });
    expect(result.ok === false && result.reason === "issues" && result.issues[0]?.elementId).toBe(
      bad.id,
    );
    expect(useDiagramStore.getState().diagrams[diagramId]!.kindMode).toBe("freehand");
    expect(useDiagramStore.getState().past.length).toBe(before);
  });

  it("says when the kind is unavailable", () => {
    const diagram = useDiagramStore
      .getState()
      .addDiagram("Missing", "context", undefined, null, undefined, { kind: "acme:missing" });
    expect(returnToKind(diagram.id)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("mergeKindEdits", () => {
  it("concatenates lists in order and keeps the last kind data", () => {
    expect(
      mergeKindEdits({ remove: ["a"], kindData: { n: 1 } }, null, {
        remove: ["b"],
        flows: { set: [] },
        kindData: { n: 2 },
      }),
    ).toEqual({ remove: ["a", "b"], flows: { set: [], remove: [] }, kindData: { n: 2 } });
  });
});
