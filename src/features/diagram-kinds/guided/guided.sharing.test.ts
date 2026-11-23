import { describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { createKindDiagram } from "../actions";
import { getDiagramKind } from "../registry";
import { guidedPhaseFlowIds } from "./guided.derive";
import { serializeGuidedDocument } from "./guided.document";
import { guidedSetPhaseStart } from "./guided.edits";
import { guidedHarness } from "./guided.harness";
import { readGuided } from "./guided.model";
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
const idOf = (h: Harness, name: string) =>
  [...h.reading().steps.values()].find((s) => s.name === name)!.id;

describe("the journey as a document", () => {
  it("writes a section per phase, steps with lanes, decisions with exits and ways back", () => {
    const h = guidedHarness();
    add(
      h,
      "## Descobrir\nUser, Atendente: A\nB\n## Comprar\nSystem: ? Pagou\n  sim -> C\n  não -> @A",
    );
    const doc = serializeGuidedDocument(h.diagram(), kindContextFor(h.diagram()));
    expect(doc).toMatch(/^# /);
    expect(doc).toContain("## Descobrir\n\n- **A** — User, Atendente\n- **B** — User");
    expect(doc).toContain("## Comprar");
    expect(doc).toContain("- Decision: **Pagou** — System");
    expect(doc).toContain("  - sim → C");
    expect(doc).toContain("  - não → back to A");
    expect(doc).toContain("- **C** — System");
  });
});

describe("phase flows", () => {
  it("derives one flow per phase, renames and removes it with the phase", () => {
    const h = guidedHarness();
    add(h, "## Discover\nUser: A\nB\n## Buy\nC\n? Ok\n  yes -> D\n  no -> @A");
    const ids = guidedPhaseFlowIds(h.diagram());
    expect(Object.keys(ids)).toHaveLength(2);
    const buy = h.diagram().snapshot.flows[ids[idOf(h, "C")]!]!;
    expect(buy.name).toMatch(/Buy$/);
    const components = Object.values(buy.steps).flatMap((s) =>
      s.componentId ? [s.componentId] : [],
    );
    expect(components.sort()).toEqual([idOf(h, "C"), idOf(h, "Ok"), idOf(h, "D")].sort());
    // The way back to A leaves the phase: the flow ends there.
    expect(components).not.toContain(idOf(h, "A"));
    const renamed = guidedSetPhaseStart(h.diagram(), idOf(h, "C"), "Pay");
    if ("refused" in renamed) throw new Error("refused");
    h.apply(renamed.edit);
    expect(h.diagram().snapshot.flows[ids[idOf(h, "C")]!]!.name).toMatch(/Pay$/);
    const removed = guidedSetPhaseStart(h.diagram(), idOf(h, "C"), "");
    if ("refused" in removed) throw new Error("refused");
    h.apply(removed.edit);
    expect(h.diagram().snapshot.flows[ids[idOf(h, "C")]!]).toBeUndefined();
    expect(Object.keys(guidedPhaseFlowIds(h.diagram()))).toHaveLength(1);
  });

  it("are offered to present, one scene per phase", () => {
    const h = guidedHarness();
    add(h, "## Discover\nUser: A\n## Buy\nB");
    const scenes = getDiagramKind("guided")!.presentation!(h.diagram())!;
    expect(scenes.map((s) => s.label)).toEqual(["Discover", "Buy"]);
    expect(scenes.every((s) => h.diagram().snapshot.flows[s.flowId])).toBe(true);
  });
});

describe("templates", () => {
  it.each(["checkout", "onboarding", "support"])(
    "builds %s with phases and no blank lanes",
    (templateId) => {
      const { diagram } = createKindDiagram({
        name: `T ${Math.random()}`,
        level: "context",
        kindId: "guided",
        templateId,
      });
      const d = useDiagramStore.getState().diagrams[diagram.id]!;
      const reading = readGuided(d);
      expect(reading.steps.size).toBeGreaterThan(5);
      expect(Object.keys(guidedPhaseFlowIds(d)).length).toBeGreaterThanOrEqual(2);
      for (const lane of reading.lanes) expect([...reading.laneOf.values()]).toContain(lane.id);
      expect([...reading.steps.values()].some((s) => s.flowShape === "diamond")).toBe(true);
    },
  );
});
