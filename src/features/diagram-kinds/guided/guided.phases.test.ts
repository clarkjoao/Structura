import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { kindOverlayFor } from "../overlay";
import { arrangeGuidedSync, guidedArrangeKey } from "./guided.arrange";
import { guidedHarness } from "./guided.harness";
import { guidedSetPhaseStart } from "./guided.edits";
import { guidedInspector } from "./guided.inspector";
import { readGuided } from "./guided.model";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";
import { serializeMermaidJourney, serializeMermaidSwimlane } from "./guided.mermaid.serialize";
import { guidedOverlay } from "./guided.overlay";
import { guidedPhases, phaseStartOf } from "./guided.phases";

registerBuiltInDiagramKinds();

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string, selected: string[] = [h.startId]) {
  const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
  const built = buildOutline(h.diagram(), parsed, selected, kindContextFor(h.diagram()));
  if ("errors" in built) throw new Error(`errors: ${JSON.stringify(built.errors)}`);
  if ("refused" in built) throw new Error(`refused: ${JSON.stringify(built.refused)}`);
  h.apply(built.edit);
}

const idOf = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)!.id;
const phaseName = (h: Harness, name: string) => {
  const { phases, phaseOf } = guidedPhases(h.reading());
  const index = phaseOf.get(idOf(h, name));
  return index === undefined ? null : phases[index]!.name;
};
const column = (h: Harness, name: string) => h.absolute(idOf(h, name)).x;

describe("phases", () => {
  it("run from their start until the next, and merge when a start is cleared", () => {
    const h = guidedHarness();
    add(h, "## Discover\nCliente: A\nB\n## Buy\nC\nD");
    expect(["A", "B", "C", "D"].map((n) => phaseName(h, n))).toEqual([
      "Discover",
      "Discover",
      "Buy",
      "Buy",
    ]);
    expect(phaseName(h, "Start")).toBeNull();
    const outcome = guidedSetPhaseStart(h.diagram(), idOf(h, "C"), "");
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    expect(phaseName(h, "D")).toBe("Discover");
    h.store.getState().undo();
    expect(phaseName(h, "D")).toBe("Buy");
  });

  it("takes the latest phase where branches converge, and a retry carries none back", () => {
    const h = guidedHarness();
    add(
      h,
      [
        "## One",
        "Cliente: A",
        "? Ok",
        "  sim -> ## Two",
        "  sim -> X",
        "  não -> Y",
        "    -> @A",
        "Z",
      ]
        .join("\n")
        .replace("  sim -> ## Two\n", ""),
    );
    // Make X start "Two": Z, reached from X, is in Two; A (retried from Y) stays in One.
    const outcome = guidedSetPhaseStart(h.diagram(), idOf(h, "X"), "Two");
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    expect(phaseName(h, "Z")).toBe("Two");
    expect(phaseName(h, "A")).toBe("One");
  });

  it("occupy contiguous columns: a short branch does not pull the next phase back", () => {
    const h = guidedHarness();
    add(
      h,
      [
        "## Discover",
        "Cliente: A",
        "? Split",
        "  long -> L1",
        "    L2",
        "    L3",
        "  short -> S1",
        "## Buy",
        "B1",
        "B2",
      ].join("\n"),
    );
    expect(column(h, "B1")).toBeGreaterThan(column(h, "L3"));
    const discover = ["A", "Split", "L1", "L2", "L3", "S1"].map((n) => column(h, n));
    const buy = ["B1", "B2"].map((n) => column(h, n));
    expect(Math.min(...buy)).toBeGreaterThan(Math.max(...discover));
  });

  it("re-arranges when a phase start changes, deterministically", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB");
    const before = guidedArrangeKey(h.diagram());
    const outcome = guidedSetPhaseStart(h.diagram(), idOf(h, "B"), "Pay");
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    expect(guidedArrangeKey(h.diagram())).not.toBe(before);
    const services = { measured: {}, gaps: { layer: 96, node: 32 } };
    expect(arrangeGuidedSync(h.diagram(), services)).toEqual(
      arrangeGuidedSync(h.diagram(), services),
    );
  });

  it("stay fast on a long journey", () => {
    const h = guidedHarness();
    const lines: string[] = ["Cliente: s0"];
    for (let i = 1; i < 300; i++) lines.push(`${i % 50 === 0 ? `## P${i / 50}\n` : ""}s${i}`);
    add(h, lines.join("\n"));
    const t0 = performance.now();
    arrangeGuidedSync(h.diagram(), { measured: {}, gaps: { layer: 96, node: 32 } });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(guidedPhases(h.reading()).phases).toHaveLength(5);
  });

  it("are shown and started from the Journey tab", () => {
    const h = guidedHarness();
    add(h, "## Discover\nCliente: A\nB");
    const ctx = { ...kindContextFor(h.diagram()), diagram: h.diagram(), selectedIds: [] };
    const section = guidedInspector.sections(ctx, idOf(h, "B"))!.find((s) => s.id === "phase")!;
    if (section.type !== "labels") throw new Error("labels");
    const item = section.items[0]!;
    expect(item.label).toBe("");
    expect(item.placeholder && "text" in item.placeholder ? item.placeholder.text : "").toContain(
      "Discover",
    );
    const outcome = item.commit("  Pay ");
    if ("refused" in outcome) throw new Error("refused");
    h.apply(outcome.edit);
    expect(phaseStartOf(h.reading().steps.get(idOf(h, "B"))!)).toBe("Pay");
  });
});

describe("the phase band and the emotion curve", () => {
  it("draws a segment per phase, separators between them, and the curve on the main path", () => {
    const h = guidedHarness();
    add(h, "## Discover\nCliente: A [5]\nB\n## Buy\nC [1]\nD [4]");
    const overlay = guidedOverlay(h.diagram())!;
    expect(overlay.axis).toBe("x");
    expect(overlay.segments.map((s) => s.label)).toEqual(["Discover", "Buy"]);
    expect(overlay.segments[0]!.to).toBe(overlay.segments[1]!.from);
    // The start sits before the first phase: a separator before Discover, one before Buy.
    expect(overlay.separators).toHaveLength(2);
    const sep = overlay.separators[1]!.along;
    expect(sep).toBeGreaterThan(h.absolute(idOf(h, "B")).x);
    expect(sep).toBeLessThan(h.absolute(idOf(h, "C")).x);
    expect(overlay.curve.map((p) => [p.value, p.tone])).toEqual([
      [1, "success"],
      [0, "danger"],
      [0.75, "success"],
    ]);
    // Above the lanes.
    const firstLane = readGuided(h.diagram()).lanes[0]!;
    expect(overlay.at + overlay.depth).toBeLessThan(h.diagram().nodeLayouts[firstLane.id]!.y);
  });

  it("is nothing without phases or scores, and nothing in freehand mode", () => {
    const h = guidedHarness();
    add(h, "Cliente: A\nB");
    expect(guidedOverlay(h.diagram())).toBeNull();
    add(h, "## P\nC", [idOf(h, "B")]);
    expect(kindOverlayFor(h.diagram())).not.toBeNull();
    h.store.getState().setKindMode(h.diagramId, "freehand");
    expect(kindOverlayFor(h.diagram())).toBeNull();
  });

  it("runs along y on a top-to-bottom diagram", () => {
    const h = guidedHarness("TB");
    add(h, "## Discover\nCliente: A\n## Buy\nB");
    const overlay = guidedOverlay(h.diagram())!;
    expect(overlay.axis).toBe("y");
    expect(overlay.segments).toHaveLength(2);
  });
});

describe("phases in text and Mermaid", () => {
  it("reads ## lines, reports a heading with no step after it", () => {
    expect(parseOutline("A\n## Lonely").errors.map((e) => [e.line, e.code])).toEqual([
      [2, "phaseWithoutStep"],
    ]);
    const h = guidedHarness();
    add(h, "## Descobrir\nCliente: Busca produto\n## Comprar\nCliente: Escolhe\nApp: Cobra");
    expect(phaseName(h, "Busca produto")).toBe("Descobrir");
    expect(phaseName(h, "Cobra")).toBe("Comprar");
  });

  it("round-trips through the outline", () => {
    const a = guidedHarness();
    add(a, "## Discover\nCliente: A\n? Ok\n  sim -> ## Buy\n  sim -> B\n  não -> ! Out\nC");
    const text = serializeGuidedOutline(a.diagram(), kindContextFor(a.diagram()));
    expect(text).toContain("## Discover");
    const b = guidedHarness();
    add(b, text);
    expect(phaseName(b, "A")).toBe("Discover");
  });

  it("keeps Mermaid journey sections and swimlane phases", () => {
    const a = guidedHarness();
    add(
      a,
      "journey\n  section Go to work\n    Make tea: 5: Me\n    Do work: 1: Me\n  section Go home\n    Sit down: 5: Me",
    );
    const journey = serializeMermaidJourney(a.diagram(), kindContextFor(a.diagram()));
    expect(journey).toContain("  section Go to work\n    Make tea: 5: Me\n    Do work: 1: Me\n");
    expect(journey).toContain("  section Go home\n    Sit down: 5: Me\n");
    const swim = serializeMermaidSwimlane(a.diagram(), kindContextFor(a.diagram()));
    expect(swim).toMatch(/%% phases: s\d+=Go to work, s\d+=Go home/);
    const b = guidedHarness();
    add(b, swim);
    expect(phaseName(b, "Do work")).toBe("Go to work");
    expect(phaseName(b, "Sit down")).toBe("Go home");
  });
});
