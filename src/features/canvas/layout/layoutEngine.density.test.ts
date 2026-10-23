import { describe, expect, it } from "vitest";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { useDiagramStore } from "@/features/diagram";
import { ELK_OPTIONS_INTERACTIVE, elkSpacingFor, layout, layoutWithSettings } from "./layoutEngine";
import { autoLayoutActiveDiagram, planDiagramAutoLayout } from "./autoLayoutDiagram";
import { REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * A diagram's density scales the tuned spacing; it never replaces it. Normal is
 * the option set the readability baselines lock, so it must add nothing at all.
 */

const LAYER_GAP = "elk.layered.spacing.nodeNodeBetweenLayers";
const NODE_GAP = "elk.spacing.nodeNode";

describe("elkSpacingFor", () => {
  it("adds nothing for absent or default settings", () => {
    expect(elkSpacingFor(undefined, false)).toEqual({});
    expect(elkSpacingFor({}, true)).toEqual({});
    expect(elkSpacingFor({ density: "normal" }, false)).toEqual({});
  });

  it("scales every tuned spacing by the density and leaves the rest alone", () => {
    const spacious = elkSpacingFor({ density: "spacious" }, false);
    expect(spacious[LAYER_GAP]).toBe(String(Math.round(220 * 1.4)));
    expect(spacious[NODE_GAP]).toBe(String(Math.round(110 * 1.4)));
    expect(spacious["elk.padding"]).toBeUndefined();
    expect(spacious["elk.spacing.portPort"]).toBeUndefined();

    const compact = elkSpacingFor({ density: "compact" }, false);
    expect(compact[LAYER_GAP]).toBe(String(Math.round(220 * 0.75)));
  });

  it("scales the labelled between-layer gap, keeping its ratio to the unlabelled one", () => {
    expect(elkSpacingFor({ density: "spacious" }, true)[LAYER_GAP]).toBe(
      String(Math.round(110 * 1.4)),
    );
  });

  it("lets an advanced gap replace its own spacing only, clamped", () => {
    const overrides = elkSpacingFor({ density: "compact", layerGap: 300 }, false);
    expect(overrides[LAYER_GAP]).toBe("300");
    expect(overrides[NODE_GAP]).toBe(String(Math.round(110 * 0.75)));
    expect(elkSpacingFor({ nodeGap: 1 }, false)[NODE_GAP]).toBe("40");
  });

  it("does not mutate the tuned option set", () => {
    const before = { ...ELK_OPTIONS_INTERACTIVE };
    elkSpacingFor({ density: "spacious", layerGap: 500 }, true);
    expect(ELK_OPTIONS_INTERACTIVE).toEqual(before);
  });
});

describe("layoutWithSettings", () => {
  const reference = REFERENCE_DIAGRAMS[0]!;
  const graph = irToLayoutGraph(reference.ir);

  it("is the tuned layout when the diagram has no settings", async () => {
    const plain = await layout(graph);
    const withNone = await layoutWithSettings(undefined)(graph);
    expect(withNone.bounds).toEqual(plain.bounds);
    expect([...withNone.boxes]).toEqual([...plain.boxes]);
  });

  it("spreads the diagram out when spacious and pulls it in when compact", async () => {
    const normal = (await layout(graph)).bounds;
    const spacious = (await layoutWithSettings({ density: "spacious" })(graph)).bounds;
    const compact = (await layoutWithSettings({ density: "compact" })(graph)).bounds;

    expect(spacious.width * spacious.height).toBeGreaterThan(normal.width * normal.height);
    expect(compact.width * compact.height).toBeLessThan(normal.width * normal.height);
  });
});

describe("every entry point uses the diagram's settings", () => {
  it("the assistant's path plans what the toolbar's path plans for the same diagram", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Density parity", "context");
    store.openDiagram(diagram.id);
    const a = store.addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.addComponent("system", "B", null, { x: 0, y: 0 });
    store.addConnection(a.id, b.id, "calls");
    store.applyAutoLayout([{ elementId: a.id, x: 0, y: 0 }], undefined, {
      layoutSettings: { density: "spacious" },
    });

    const stored = useDiagramStore.getState().diagrams[diagram.id]!;
    expect(stored.layoutSettings).toEqual({ density: "spacious" });
    // What the toolbar hands the planner: the diagram as stored, with its settings.
    const toolbarPlan = await planDiagramAutoLayout({
      components: stored.snapshot.components,
      connections: Object.values(stored.snapshot.connections),
      nodeLayouts: stored.nodeLayouts,
      autoRefs: true,
      settings: stored.layoutSettings,
    });

    const assistantPlan = await autoLayoutActiveDiagram();

    expect(assistantPlan?.settings).toEqual({ density: "spacious" });
    expect(assistantPlan?.layouts).toEqual(toolbarPlan.layouts);
  });
});
