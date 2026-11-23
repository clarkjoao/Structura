import { describe, expect, it } from "vitest";
import { kindCommandContextFor, kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { kindMarkersFor } from "../markers";
import { kindOverlayFor } from "../overlay";
import { guidedElementActions } from "./guided.elementActions";
import { guidedRemoveLane, guidedSetParticipants, guidedSetVisibilityLine } from "./guided.edits";
import { guidedHarness } from "./guided.harness";
import { participantsOf, readGuided, visibilityLaneOf } from "./guided.model";
import { guidedOverlay } from "./guided.overlay";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";
import { serializeMermaidJourney, serializeMermaidSwimlane } from "./guided.mermaid.serialize";

registerBuiltInDiagramKinds();

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string) {
  const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
  const built = buildOutline(h.diagram(), parsed, [h.startId], kindContextFor(h.diagram()));
  if (!("edit" in built)) throw new Error(JSON.stringify(built));
  h.apply(built.edit);
}
const laneId = (h: Harness, name: string) => h.reading().lanes.find((l) => l.name === name)!.id;
const stepOf = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)!;
const line = (h: Harness) => visibilityLaneOf(h.diagram(), h.reading());
const actions = (h: Harness, id: string) =>
  guidedElementActions(kindCommandContextFor(h.diagram(), [id]), id);

describe("the line of visibility", () => {
  it("is set above a lane, moved, removed, and undone", () => {
    const h = guidedHarness();
    const system = laneId(h, "System");
    h.apply(guidedSetVisibilityLine(h.diagram(), system));
    expect(line(h)).toBe(system);
    h.store.getState().undo();
    expect(line(h)).toBeNull();
  });

  it("is offered on a lane's menu, never above the first lane", () => {
    const h = guidedHarness();
    const [first, second] = h.reading().lanes;
    expect(actions(h, first!.id).some((a) => a.id === "guided.lane.visibility")).toBe(false);
    const set = actions(h, second!.id).find((a) => a.id === "guided.lane.visibility")!;
    expect(set.label).toEqual({ key: "diagramKinds.guided.blueprint.lineAbove" });
    const outcome = set.run();
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    expect(actions(h, second!.id).find((a) => a.id === "guided.lane.visibility")!.label).toEqual({
      key: "diagramKinds.guided.blueprint.removeLine",
    });
  });

  it("goes with its lane, and reads as none on the first lane", () => {
    const h = guidedHarness();
    const system = laneId(h, "System");
    h.apply(guidedSetVisibilityLine(h.diagram(), system));
    const removed = guidedRemoveLane(h.diagram(), system);
    if ("refused" in removed) throw new Error("refused");
    h.apply(removed);
    expect(line(h)).toBeNull();
    expect(h.diagram().kindData?.visibilityLane).toBeUndefined();
    const g = guidedHarness();
    g.apply(guidedSetVisibilityLine(g.diagram(), laneId(g, "User")));
    expect(line(g)).toBeNull();
  });

  it("is drawn along the lanes, labelled, and only in kind mode", () => {
    const h = guidedHarness();
    expect(guidedOverlay(h.diagram())).toBeNull();
    const system = laneId(h, "System");
    h.apply(guidedSetVisibilityLine(h.diagram(), system));
    const overlay = guidedOverlay(h.diagram())!;
    expect(overlay.segments).toEqual([]);
    const [drawn] = overlay.lines!;
    expect(drawn!.across).toBe(h.diagram().nodeLayouts[system]!.y);
    expect(drawn!.to).toBeGreaterThan(drawn!.from);
    expect(drawn!.labels).toEqual({
      before: { key: "diagramKinds.guided.blueprint.frontstage" },
      after: { key: "diagramKinds.guided.blueprint.backstage" },
    });
    // Through the memoised read too: the line lives in the kind data, not the snapshot.
    expect(kindOverlayFor(h.diagram())!.lines).toHaveLength(1);
    h.apply(guidedSetVisibilityLine(h.diagram(), null));
    expect(kindOverlayFor(h.diagram())).toBeNull();
    h.store.getState().setKindMode(h.diagramId, "freehand");
    expect(kindOverlayFor(h.diagram())).toBeNull();
  });

  it("runs across x on a top-to-bottom journey", () => {
    const h = guidedHarness("TB");
    const system = laneId(h, "System");
    h.apply(guidedSetVisibilityLine(h.diagram(), system));
    const overlay = guidedOverlay(h.diagram())!;
    expect(overlay.axis).toBe("y");
    expect(overlay.lines![0]!.across).toBe(h.diagram().nodeLayouts[system]!.x);
  });
});

describe("participants", () => {
  it("are cleaned: trimmed, distinct, capped, never the own lane; one undo", () => {
    const h = guidedHarness();
    add(h, "User: Revisa");
    const step = stepOf(h, "Revisa");
    const names = [
      " Atendente ",
      "atendente",
      "User",
      "",
      ...Array.from({ length: 10 }, (_, i) => `P${i}`),
    ];
    const outcome = guidedSetParticipants(h.diagram(), step.id, names);
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    const got = participantsOf(stepOf(h, "Revisa"), "User");
    expect(got[0]).toBe("Atendente");
    expect(got).toHaveLength(8);
    expect(got).not.toContain("User");
    h.store.getState().undo();
    expect(participantsOf(stepOf(h, "Revisa"))).toEqual([]);
  });

  it("show as a tag on the step, not a check", () => {
    const h = guidedHarness();
    add(h, "User, Atendente, Gerente: Revisa\n! Fim");
    const sets = kindMarkersFor(h.diagram());
    const id = stepOf(h, "Revisa").id;
    expect(sets.tags.get(id)).toEqual({ text: "+ Atendente +1", title: "Atendente, Gerente" });
    expect(sets.nodes.has(id)).toBe(false);
  });
});

describe("blueprint text", () => {
  it("reads the separator and participants, and writes them back", () => {
    const h = guidedHarness();
    add(h, "User:\n---\nAtendente:\nUser, Atendente: Revisa pedido\nAtendente: Confirma");
    const r = readGuided(h.diagram());
    expect(line(h)).toBe(laneId(h, "Atendente"));
    expect(participantsOf(stepOf(h, "Revisa pedido"))).toEqual(["Atendente"]);
    expect(r.lanes.find((l) => l.id === r.laneOf.get(stepOf(h, "Revisa pedido").id))!.name).toBe(
      "User",
    );
    const text = serializeGuidedOutline(h.diagram(), kindContextFor(h.diagram()));
    expect(text).toMatch(/---\nAtendente:/);
    expect(text).toContain("User, Atendente: Revisa pedido");
    const copy = guidedHarness();
    add(copy, text);
    expect(line(copy)).toBe(laneId(copy, "Atendente"));
    expect(participantsOf(stepOf(copy, "Revisa pedido"))).toEqual(["Atendente"]);
  });

  it("reports a misplaced separator, and escapes a comma in a lane name", () => {
    expect(parseOutline("User: A\n---\nB").errors.map((e) => [e.line, e.code])).toEqual([
      [2, "visibilityMisplaced"],
    ]);
    expect(parseOutline("User:\n---").errors.map((e) => e.code)).toEqual(["visibilityMisplaced"]);
    const h = guidedHarness();
    add(h, "Vendas\\, Norte: Liga");
    expect(h.reading().lanes.map((l) => l.name)).toContain("Vendas, Norte");
    expect(serializeGuidedOutline(h.diagram(), kindContextFor(h.diagram()))).toContain(
      "Vendas\\, Norte:",
    );
  });

  it("keeps every Mermaid journey actor and the swimlane comments", () => {
    const h = guidedHarness();
    add(h, "journey\n  section Work\n    Do work: 1: Me, Cat\n    Rest: 4: Me");
    expect(participantsOf(stepOf(h, "Do work"))).toEqual(["Cat"]);
    expect(serializeMermaidJourney(h.diagram(), kindContextFor(h.diagram()))).toContain(
      "Do work: 3: Me, Cat",
    );
    h.apply(guidedSetVisibilityLine(h.diagram(), laneId(h, "System")));
    const swim = serializeMermaidSwimlane(h.diagram(), kindContextFor(h.diagram()));
    expect(swim).toMatch(/%% participants: s\d+=Cat/);
    expect(swim).toMatch(/%% visibility: lane\d+/);
    const copy = guidedHarness();
    add(copy, swim);
    expect(participantsOf(stepOf(copy, "Do work"))).toEqual(["Cat"]);
    expect(line(copy)).toBe(laneId(copy, "System"));
  });
});
