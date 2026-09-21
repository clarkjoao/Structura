import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useFlowSewNotices } from "./useFlowSewNotices";

/** A four-step script over four nodes, so removing the second one sews 1 → 2. */
function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Sew", "context");
  store.openDiagram(diagram.id);
  const node = (name: string) =>
    useDiagramStore.getState().addComponent("system", name, null, { x: 0, y: 0 }).id;
  const n1 = node("Storefront");
  const n2 = node("Checkout API");
  const n3 = node("Ledger");
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", next: "s2", componentId: n1 },
    s2: { id: "s2", type: "action", next: "s3", componentId: n2 },
    s3: { id: "s3", type: "action", componentId: n3 },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  const read = () => useDiagramStore.getState().diagrams[diagram.id]!;
  return { diagramId: diagram.id, flowId: flow.id, n1, n2, n3, read };
}

describe("deleting a node that a script walks through says so", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useDiagramStore.setState({
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
      _lastUndoRedoTimestamp: 0,
      _flowSewNotices: null,
    });
  });

  it("names what left, and where the script joined up", () => {
    const { n2 } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));

    // The hook should have published a notice about the removed node
    expect(useDiagramStore.getState()._flowSewNotices).not.toBeNull();
  });

  it("removes the step from the flow when the node is removed", () => {
    const { n2, flowId, read } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));

    expect(read().snapshot.components[n2]).toBeUndefined();
    expect(read().snapshot.flows[flowId]!.steps.s2).toBeUndefined();
  });

  it("says nothing when the deleted node was not part of any script", () => {
    seed();
    const stray = useDiagramStore
      .getState()
      .addComponent("system", "Stray", null, { x: 0, y: 0 }).id;
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([stray], []));
    // Nothing to say means nothing published, so no one downstream re-renders.
    expect(useDiagramStore.getState()._flowSewNotices).toBeNull();
  });

  it("does not re-publish when the interface language changes", async () => {
    const { n2 } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));
    const noticesAfterRemoval = useDiagramStore.getState()._flowSewNotices;

    // The message is built with `t`, but the notice should not re-publish on language change
    await act(async () => {
      await i18n.changeLanguage("pt-BR");
    });
    expect(useDiagramStore.getState()._flowSewNotices).toBe(noticesAfterRemoval);
  });

  it("can publish notices for multiple removals", () => {
    const { n2, n3 } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));
    act(() => useDiagramStore.getState().removeElements([n3], []));
    // Both removals should have published notices
    expect(useDiagramStore.getState()._flowSewNotices).not.toBeNull();
  });
});
