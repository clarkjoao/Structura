import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { kindMarkersFor } from "../markers";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { guidedHarness } from "./guided.harness";
import { guidedSetExperience } from "./guided.edits";
import { guidedInspector } from "./guided.inspector";
import { guidedKind } from "./guided.kind";
import { experienceOf } from "./guided.model";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";
import { serializeMermaidJourney, serializeMermaidSwimlane } from "./guided.mermaid.serialize";

registerBuiltInDiagramKinds();

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string, selected: string[] = [h.startId]) {
  const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
  const built = buildOutline(h.diagram(), parsed, selected, kindContextFor(h.diagram()));
  if ("errors" in built) throw new Error(`errors: ${JSON.stringify(built.errors)}`);
  if ("refused" in built) throw new Error(`refused: ${JSON.stringify(built.refused)}`);
  h.apply(built.edit);
}

const step = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)!;
const scoreOf = (h: Harness, name: string) => experienceOf(step(h, name));

describe("the experience score", () => {
  it("is set, replaced and cleared in one undo step each, keeping other kind data", () => {
    const h = guidedHarness();
    add(h, "Cliente: Paga");
    const id = step(h, "Paga").id;
    const set = (score: number | null) => {
      const outcome = guidedSetExperience(h.diagram(), id, score);
      if ("refused" in outcome) throw new Error("refused");
      h.apply(outcome.edit);
    };
    h.apply({ update: [{ id, kindProps: { phase: "Buy" } }] });
    set(2);
    expect(step(h, "Paga").kindProps).toEqual({ phase: "Buy", experience: 2 });
    set(null);
    expect(step(h, "Paga").kindProps).toEqual({ phase: "Buy" });
    h.store.getState().undo();
    expect(scoreOf(h, "Paga")).toBe(2);
  });

  it("is offered in the Journey tab", () => {
    const h = guidedHarness();
    add(h, "Cliente: Paga [4]");
    const ctx = { ...kindContextFor(h.diagram()), diagram: h.diagram(), selectedIds: [] };
    const section = guidedInspector
      .sections(ctx, step(h, "Paga").id)!
      .find((s) => s.id === "experience")!;
    if (section.type !== "choice") throw new Error("choice");
    expect(section.options.map((o) => o.id)).toEqual(["none", "1", "2", "3", "4", "5"]);
    expect(section.options.find((o) => o.selected)?.id).toBe("4");
  });

  it("shows a badge by tone, outlines pain points only, in reading order", () => {
    const h = guidedHarness();
    add(h, "Cliente: A [5]\nB [3]\nC [1]\nD [2]");
    const sets = kindMarkersFor(h.diagram());
    expect(sets.badges.get(step(h, "A").id)).toEqual({ text: "😄 5", tone: "success" });
    expect(sets.badges.get(step(h, "B").id)?.tone).toBe("neutral");
    expect(sets.badges.get(step(h, "C").id)).toEqual({ text: "😞 1", tone: "danger" });
    expect(sets.nodes.has(step(h, "A").id)).toBe(false);
    expect(sets.nodes.has(step(h, "C").id)).toBe(true);
    const pain = sets.markers.filter((m) => m.code === "painPoint").map((m) => m.elementId);
    expect(pain).toEqual([step(h, "C").id, step(h, "D").id]);
    expect(guidedKind.focusMarkers?.code).toBe("painPoint");
  });

  it("shows nothing in freehand mode", () => {
    const h = guidedHarness();
    add(h, "Cliente: A [1]");
    h.store.getState().setKindMode(h.diagramId, "freehand");
    expect(kindMarkersFor(h.diagram()).badges.size).toBe(0);
    expect(scoreOf(h, "A")).toBe(1);
  });
});

describe("the score in text and Mermaid", () => {
  it("reads `[n]`, reports one out of range, and keeps an escaped bracket", () => {
    const parsed = parseOutline("Paga [2]\nCobra [7]\nVersão \\[3]");
    expect(parsed.errors.map((e) => [e.line, e.code])).toEqual([[2, "experienceOutOfRange"]]);
    const h = guidedHarness();
    add(h, "Cliente: Paga com Pix [2]\nVersão \\[3]");
    expect(scoreOf(h, "Paga com Pix")).toBe(2);
    expect(scoreOf(h, "Versão [3]")).toBeNull();
  });

  it("round-trips through the outline", () => {
    const a = guidedHarness();
    add(a, "Cliente: Escolhe [4]\nApp: Cobra [1]\n! Fim");
    const text = serializeGuidedOutline(a.diagram(), kindContextFor(a.diagram()));
    expect(text).toContain("Escolhe [4]");
    const b = guidedHarness();
    add(b, text);
    expect(scoreOf(b, "Escolhe")).toBe(4);
    expect(scoreOf(b, "Cobra")).toBe(1);
  });

  it("keeps Mermaid journey scores both ways", () => {
    const h = guidedHarness();
    add(h, "journey\n  section Day\n  Make tea: 5: Me\n  Do work: 1: Me, Cat\n  Rest: 3: Me");
    expect(scoreOf(h, "Do work")).toBe(1);
    const text = serializeMermaidJourney(h.diagram(), kindContextFor(h.diagram()));
    expect(text).toContain("Make tea: 5: Me");
    expect(text).toContain("Do work: 1: Me");
  });

  it("keeps scores through the Mermaid swimlane comment", () => {
    const a = guidedHarness();
    add(a, "Cliente: Escolhe [4]\nApp: Cobra [2]");
    const text = serializeMermaidSwimlane(a.diagram(), kindContextFor(a.diagram()));
    expect(text).toMatch(/%% experience: s\d+=4, s\d+=2/);
    const b = guidedHarness();
    add(b, text);
    expect(scoreOf(b, "Escolhe")).toBe(4);
    expect(scoreOf(b, "Cobra")).toBe(2);
  });
});
