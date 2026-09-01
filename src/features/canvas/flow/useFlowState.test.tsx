import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { FlowModeProvider, useFlowMode } from "./FlowModeContext";
import { useFlowState } from "./useFlowState";
import { useFlowViewStore } from "./useFlowViewStore";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * A branched flow over three real components, so the badges have something to
 * land on: 1 → 2(condition) with 2a and 2b, meeting again at 3.
 */
function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Badges", "context");
  store.openDiagram(diagram.id);
  const node = (name: string) =>
    useDiagramStore.getState().addComponent("system", name, null, { x: 0, y: 0 }).id;
  const n1 = node("Storefront");
  const n2 = node("Checkout API");
  const n3 = node("Ledger");
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", next: "c", componentId: n1 },
    c: {
      id: "c",
      type: "condition",
      conditionLabel: "paid?",
      branches: [
        { label: "yes", nextId: "a1" },
        { label: "no", nextId: "b1" },
      ],
    },
    a1: { id: "a1", type: "action", next: "join", componentId: n2 },
    b1: { id: "b1", type: "action", next: "join", componentId: n3 },
    join: { id: "join", type: "action", componentId: n1 },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  const flows = (): Flow[] =>
    Object.values(useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows);
  return { flowId: flow.id, flows, n1, n2, n3 };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <FlowModeProvider>{children}</FlowModeProvider>
);

describe("the canvas is numbered from the flow whose script is open", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("shows no numbers while no script is open", () => {
    const { flows } = seed();
    const { result } = renderHook(() => useFlowState({ flows: flows() }), { wrapper });
    expect(result.current.flowBadges).toBeNull();
  });

  it("numbers the canvas from the open flow, outside any recording", () => {
    const { flowId, flows, n1, n2, n3 } = seed();
    act(() => useFlowViewStore.getState().openScript(flowId));
    const { result } = renderHook(() => useFlowState({ flows: flows() }), { wrapper });

    const badges = result.current.flowBadges!;
    expect(result.current.isPlaying).toBe(false);
    expect(badges.nodeLabels.get(n2)).toEqual(["2a"]);
    expect(badges.nodeLabels.get(n3)).toEqual(["2b"]);
    // Visited twice: once at the start, once where the branches meet again.
    expect(badges.nodeLabels.get(n1)).toEqual(["1", "3"]);
  });

  it("goes back to no numbers when the script is closed again", () => {
    const { flowId, flows } = seed();
    act(() => useFlowViewStore.getState().openScript(flowId));
    const { result, rerender } = renderHook(() => useFlowState({ flows: flows() }), { wrapper });
    expect(result.current.flowBadges).not.toBeNull();
    act(() => useFlowViewStore.getState().openScript(null));
    rerender();
    expect(result.current.flowBadges).toBeNull();
  });

  it("narrows to the branch in hand while it is being recorded", () => {
    const { flowId, flows, n1, n2, n3 } = seed();
    const { result } = renderHook(
      () => ({ state: useFlowState({ flows: flows() }), mode: useFlowMode() }),
      { wrapper },
    );
    const flow = flows().find((candidate) => candidate.id === flowId)!;

    act(() => result.current.mode.editFlow(flow));
    act(() =>
      result.current.mode.setRecordingContext({
        mode: "branch-record",
        conditionStepId: "c",
        branchIndex: 0,
        branchLabel: "yes",
      }),
    );

    const badges = result.current.state.flowBadges!;
    expect(badges.nodeLabels.get(n2)).toEqual(["2a"]);
    expect(badges.nodeLabels.has(n3)).toBe(false);
    expect(badges.nodeLabels.has(n1)).toBe(false);

    act(() =>
      result.current.mode.setRecordingContext({
        mode: "branch-record",
        conditionStepId: "c",
        branchIndex: 1,
        branchLabel: "no",
      }),
    );
    const other = result.current.state.flowBadges!;
    expect(other.nodeLabels.get(n3)).toEqual(["2b"]);
    expect(other.nodeLabels.has(n2)).toBe(false);

    act(() => result.current.mode.cancelRecording());
  });

  it("numbers only one flow at a time", () => {
    const { flowId, flows } = seed();
    const second = useDiagramStore
      .getState()
      .addFlow(useDiagramStore.getState().activeDiagramId!, "Other", "")!;
    act(() => useFlowViewStore.getState().openScript(flowId));
    const { result } = renderHook(() => useFlowState({ flows: flows() }), { wrapper });
    const badged = [...result.current.flowBadges!.badgedNodeIds];
    const otherSteps = Object.values(second.steps).map((step) => step.componentId);
    expect(badged.some((id) => otherSteps.includes(id))).toBe(false);
  });
});
