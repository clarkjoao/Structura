import { afterEach, describe, expect, it } from "vitest";
import type { Walkthrough, WalkthroughStep } from "../types";
import {
  migrateWalkthroughStepsDiagramId,
  useWalkthroughsStore,
} from "../store/walkthroughs.store";

describe("walkthroughs store", () => {
  afterEach(() => {
    useWalkthroughsStore.setState({ walkthroughs: {} });
  });

  it("addWalkthrough creates walkthrough with expected fields", () => {
    const walkthrough = useWalkthroughsStore.getState().addWalkthrough("Alpha", "desc", "domain");
    expect(walkthrough.name).toBe("Alpha");
    expect(walkthrough.description).toBe("desc");
    expect(walkthrough.domain).toBe("domain");
    expect(walkthrough.tags).toEqual([]);
    expect(walkthrough.steps).toEqual({});
    expect(typeof walkthrough.id).toBe("string");
    expect(walkthrough.createdAt).toBe(walkthrough.updatedAt);
    expect(useWalkthroughsStore.getState().walkthroughs[walkthrough.id]).toEqual(walkthrough);
  });

  it("addWalkthroughStep assigns incrementing order", () => {
    const { id: walkthroughId } = useWalkthroughsStore.getState().addWalkthrough("J");
    const first = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "A",
      diagramId: "d1",
    });
    const second = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "B",
      diagramId: "d1",
    });
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });

  it("addWalkthroughStep normalizes missing diagramId to empty string", () => {
    const { id: walkthroughId } = useWalkthroughsStore.getState().addWalkthrough("J");
    const step = useWalkthroughsStore
      .getState()
      .addWalkthroughStep(walkthroughId, { label: "A" } as unknown as Omit<
        WalkthroughStep,
        "id" | "order"
      >);
    expect(step.diagramId).toBe("");
  });

  it("reorderWalkthroughSteps updates step order fields", () => {
    const { id: walkthroughId } = useWalkthroughsStore.getState().addWalkthrough("J");
    const a = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "A",
      diagramId: "d",
    });
    const b = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "B",
      diagramId: "d",
    });
    const c = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "C",
      diagramId: "d",
    });
    useWalkthroughsStore.getState().reorderWalkthroughSteps(walkthroughId, [c.id, a.id, b.id]);
    const steps = useWalkthroughsStore.getState().walkthroughs[walkthroughId]!.steps;
    expect(steps[c.id]!.order).toBe(0);
    expect(steps[a.id]!.order).toBe(1);
    expect(steps[b.id]!.order).toBe(2);
  });

  it("removeWalkthroughStep removes step and reindexes order", () => {
    const { id: walkthroughId } = useWalkthroughsStore.getState().addWalkthrough("J");
    useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "A",
      diagramId: "d",
    });
    const b = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "B",
      diagramId: "d",
    });
    useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "C",
      diagramId: "d",
    });
    useWalkthroughsStore.getState().removeWalkthroughStep(walkthroughId, b.id);
    const steps = Object.values(useWalkthroughsStore.getState().walkthroughs[walkthroughId]!.steps);
    expect(steps).toHaveLength(2);
    const byLabel = Object.fromEntries(steps.map((step) => [step.label, step]));
    expect(byLabel.A?.order).toBe(0);
    expect(byLabel.C?.order).toBe(1);
    expect(byLabel.B).toBeUndefined();
  });

  it("updateWalkthroughStep updates one step without changing others", () => {
    const { id: walkthroughId } = useWalkthroughsStore.getState().addWalkthrough("J");
    const a = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "A",
      diagramId: "d1",
    });
    const b = useWalkthroughsStore.getState().addWalkthroughStep(walkthroughId, {
      label: "B",
      diagramId: "d2",
    });
    useWalkthroughsStore.getState().updateWalkthroughStep(walkthroughId, a.id, {
      label: "A2",
      diagramId: "dx",
    });
    const walkthrough = useWalkthroughsStore.getState().walkthroughs[walkthroughId]!;
    expect(walkthrough.steps[a.id]!.label).toBe("A2");
    expect(walkthrough.steps[a.id]!.diagramId).toBe("dx");
    expect(walkthrough.steps[b.id]).toEqual(b);
  });

  it("removeWalkthrough removes the walkthrough", () => {
    const { id } = useWalkthroughsStore.getState().addWalkthrough("J");
    useWalkthroughsStore.getState().removeWalkthrough(id);
    expect(useWalkthroughsStore.getState().walkthroughs[id]).toBeUndefined();
  });

  it("migrateWalkthroughStepsDiagramId fills missing diagramId with empty string", () => {
    const legacy = {
      j1: {
        id: "j1",
        name: "J",
        tags: [],
        steps: {
          s1: { id: "s1", label: "a", order: 0 },
        },
        createdAt: 1,
        updatedAt: 1,
      },
    } as unknown as Record<string, Walkthrough>;
    const migrated = migrateWalkthroughStepsDiagramId(legacy);
    expect(migrated.j1.steps.s1.diagramId).toBe("");
  });
});
