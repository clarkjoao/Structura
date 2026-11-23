import { describe, expect, it } from "vitest";
import { kindCommandContextFor, kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { guidedHarness } from "./guided.harness";
import { guidedNameCommit } from "./guided.names";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";

registerBuiltInDiagramKinds();

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string) {
  const built = buildOutline(
    h.diagram(),
    parseOutline(text),
    [h.startId],
    kindContextFor(h.diagram()),
  );
  if (!("edit" in built)) throw new Error(JSON.stringify(built));
  h.apply(built.edit);
}
const stepOf = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)!;
const commit = (h: Harness, id: string, text: string) =>
  guidedNameCommit(kindCommandContextFor(h.diagram(), [id]), id, text);

describe("step name shortcuts", () => {
  it("makes a decision in another lane in one undo step", () => {
    const h = guidedHarness();
    add(h, "User: Validate\nNext");
    const id = stepOf(h, "Validate").id;
    const outcome = commit(h, id, "System: ? Valid?");
    if (!outcome || "refused" in outcome) throw new Error("no outcome");
    h.apply(outcome.edit);
    const step = h.reading().steps.get(id)!;
    expect(step.name).toBe("Valid?");
    expect(step.flowShape).toBe("diamond");
    expect(h.reading().lanes.find((l) => l.id === h.reading().laneOf.get(id))!.name).toBe("System");
    h.store.getState().undo();
    expect(h.reading().steps.get(id)!.name).toBe("Validate");
    expect(h.reading().steps.get(id)!.flowShape).not.toBe("diamond");
  });

  it("makes an end, but refuses one with exits", () => {
    const h = guidedHarness();
    add(h, "User: A\nB");
    const b = stepOf(h, "B").id;
    const outcome = commit(h, b, "! Done");
    if (!outcome || "refused" in outcome) throw new Error("no outcome");
    h.apply(outcome.edit);
    expect(h.reading().steps.get(b)!.flowShape).toBe("end");
    const refused = commit(h, stepOf(h, "A").id, "! Stop");
    expect(refused && "refused" in refused).toBe(true);
  });

  it("keeps escaped characters, plain names and unknown lane prefixes as typed", () => {
    const h = guidedHarness();
    add(h, "User: A");
    const a = stepOf(h, "A").id;
    const escaped = commit(h, a, "\\? Help");
    if (!escaped || "refused" in escaped) throw new Error("no outcome");
    h.apply(escaped.edit);
    expect(h.reading().steps.get(a)!.name).toBe("? Help");
    expect(h.reading().steps.get(a)!.flowShape).not.toBe("diamond");
    expect(commit(h, a, "Plain name")).toBeNull();
    expect(commit(h, a, "Reunião: kickoff")).toBeNull();
  });
});
