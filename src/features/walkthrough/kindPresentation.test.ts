import { beforeEach, describe, expect, it } from "vitest";
import { useWalkthroughStore } from "./store/walkthrough.store";
import { upsertKindPresentation } from "./kindPresentation";

describe("presenting a diagram by its kind's scenes", () => {
  beforeEach(() => {
    localStorage.clear();
    useWalkthroughStore.setState({ presentations: {}, hydrated: true });
  });

  it("creates the walkthrough, then updates the same one, keeping a scene's note", async () => {
    const diagram = { id: "d1", name: "Checkout" };
    const first = await upsertKindPresentation(diagram, [
      { label: "Discover", flowId: "f1" },
      { label: "Buy", flowId: "f2" },
    ]);
    expect(first.title).toBe("Checkout");
    expect(first.steps.map((s) => [s.label, s.flowId, s.diagramId])).toEqual([
      ["Discover", "f1", "d1"],
      ["Buy", "f2", "d1"],
    ]);
    await useWalkthroughStore.getState().save({
      ...first,
      steps: first.steps.map((s) => (s.flowId === "f2" ? { ...s, note: "Say why" } : s)),
    });
    const second = await upsertKindPresentation(diagram, [
      { label: "Pay", flowId: "f2" },
      { label: "Use", flowId: "f3" },
    ]);
    expect(second.id).toBe(first.id);
    expect(Object.keys(useWalkthroughStore.getState().presentations)).toHaveLength(1);
    expect(second.steps.map((s) => [s.label, s.note])).toEqual([
      ["Pay", "Say why"],
      ["Use", undefined],
    ]);
  });
});
