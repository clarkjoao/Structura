import { describe, expect, it } from "vitest";
import { registerBuiltInDiagramKinds } from "./bootstrap";
import { kindMarkersFor } from "./markers";
import { guidedHarness } from "./guided/guided.harness";

registerBuiltInDiagramKinds();

describe("kind markers", () => {
  it("marks an unlabelled decision exit and an open end, and clears them when fixed", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    h.run("guided.branch", [step]);
    const decision = h.reading().outgoing.get(step)![0]!.targetId;
    const exit = h.reading().outgoing.get(decision)![0]!;
    const marks = kindMarkersFor(h.diagram());
    expect(marks.connections.has(exit.id)).toBe(true);
    expect(marks.nodes.size).toBeGreaterThan(0);
    h.label(exit.id, "ok");
    expect(kindMarkersFor(h.diagram()).connections.has(exit.id)).toBe(false);
  });

  it("is memoised on the snapshot", () => {
    const h = guidedHarness();
    expect(kindMarkersFor(h.diagram())).toBe(kindMarkersFor(h.diagram()));
  });

  it("marks nothing in freehand mode or on a freehand diagram", () => {
    const h = guidedHarness();
    h.run("guided.next", [h.startId]);
    h.store.getState().setKindMode(h.diagramId, "freehand");
    expect(kindMarkersFor(h.diagram()).markers).toEqual([]);
    expect(kindMarkersFor(null).markers).toEqual([]);
  });
});
