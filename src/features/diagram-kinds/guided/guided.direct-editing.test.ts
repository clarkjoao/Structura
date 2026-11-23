import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { guidedMovePhaseStart } from "./guided.edits";
import { guidedHarness } from "./guided.harness";
import { guidedOverlay } from "./guided.overlay";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { guidedPhases } from "./guided.phases";

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
const idOf = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)!.id;
const phaseNames = (h: Harness) => guidedPhases(h.reading()).phases.map((p) => p.name);
const phaseOfStep = (h: Harness, name: string) => {
  const { phases, phaseOf } = guidedPhases(h.reading());
  const index = phaseOf.get(idOf(h, name));
  return index === undefined ? null : phases[index]!.name;
};
function run(h: Harness, outcome: ReturnType<typeof guidedMovePhaseStart>) {
  if ("refused" in outcome) throw new Error("refused");
  h.apply(outcome.edit);
}

describe("editing phases on the band", () => {
  it("renames a phase in place, removes it with an empty name, and undoes", () => {
    const h = guidedHarness();
    add(h, "## Discover\nUser: A\nB\n## Buy\nC\nD");
    const buy = guidedOverlay(h.diagram())!.segments[1]!;
    run(h, buy.rename!("Pay"));
    expect(phaseNames(h)).toEqual(["Discover", "Pay"]);
    h.store.getState().undo();
    expect(phaseNames(h)).toEqual(["Discover", "Buy"]);
    run(h, guidedOverlay(h.diagram())!.segments[1]!.rename!(""));
    expect(phaseNames(h)).toEqual(["Discover"]);
  });

  it("moves a phase start earlier and later, within its neighbours", () => {
    const h = guidedHarness();
    add(h, "## Discover\nUser: A\nB\n## Buy\nC\nD\n## Use\nE");
    // Candidates: B (earlier) and D (later) — never A (Discover's start) or E (Use's).
    const sepBeforeBuy = guidedOverlay(h.diagram())!.separators[1]!;
    expect(sepBeforeBuy.moves).toHaveLength(2);
    const [toB, toD] = sepBeforeBuy.moves!;
    run(h, toB!.run());
    expect(["A", "B", "C", "D", "E"].map((n) => phaseOfStep(h, n))).toEqual([
      "Discover",
      "Buy",
      "Buy",
      "Buy",
      "Use",
    ]);
    h.store.getState().undo();
    run(h, toD!.run());
    expect(phaseOfStep(h, "C")).toBe("Discover");
    expect(phaseOfStep(h, "D")).toBe("Buy");
  });
});
