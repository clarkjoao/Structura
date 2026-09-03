import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useFlowSewNotices } from "./useFlowSewNotices";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
const { toast } = await import("sonner");

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
    vi.mocked(toast.warning).mockClear();
    useDiagramStore.setState({ past: [], future: [], _lastUndoRedoAt: 0, _flowSewNotices: null });
  });

  it("names what left, and where the script joined up", () => {
    const { n2 } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));

    expect(toast.warning).toHaveBeenCalledTimes(1);
    const [message] = vi.mocked(toast.warning).mock.calls[0]!;
    expect(message).toContain("Checkout API");
    expect(message).toContain("Checkout");
    expect(message).toContain("1 → 2");
  });

  it("offers to put the node and the step back together", () => {
    const { n2, flowId, read } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));

    expect(read().snapshot.components[n2]).toBeUndefined();
    expect(read().snapshot.flows[flowId]!.steps.s2).toBeUndefined();

    const [, options] = vi.mocked(toast.warning).mock.calls[0]!;
    const undoAction = (options as unknown as { action: { onClick: () => void } }).action;
    act(() => undoAction.onClick());

    expect(read().snapshot.components[n2]).toBeDefined();
    expect(read().snapshot.flows[flowId]!.steps.s2).toBeDefined();
    expect(read().snapshot.flows[flowId]!.steps.s1!.next).toBe("s2");
  });

  it("says nothing when the deleted node was not part of any script", () => {
    seed();
    const stray = useDiagramStore
      .getState()
      .addComponent("system", "Stray", null, { x: 0, y: 0 }).id;
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([stray], []));
    expect(toast.warning).not.toHaveBeenCalled();
    // Nothing to say means nothing published, so no one downstream re-renders.
    expect(useDiagramStore.getState()._flowSewNotices).toBeNull();
  });

  it("does not say it again when the interface language changes", async () => {
    const { n2 } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));
    expect(toast.warning).toHaveBeenCalledTimes(1);

    // The message is built with `t`, so a language change re-runs the effect
    // over a batch that has already been said.
    await act(async () => {
      await i18n.changeLanguage("pt-BR");
    });
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("says it again when the same kind of removal happens twice", () => {
    const { n2, n3 } = seed();
    renderHook(() => useFlowSewNotices());
    act(() => useDiagramStore.getState().removeElements([n2], []));
    act(() => useDiagramStore.getState().removeElements([n3], []));
    expect(toast.warning).toHaveBeenCalledTimes(2);
  });
});
