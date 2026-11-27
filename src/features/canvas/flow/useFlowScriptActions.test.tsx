import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderHook } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useFlowScriptActions } from "./useFlowScriptActions";

vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

/** s1 -> cond(yes: a1 -> a2, no: b1) with nothing joining them: dropping "yes" loses two steps. */
function seedCondition(branchSteps: Record<string, FlowStep>, branches: string[]) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Branches", "context");
  store.openDiagram(diagram.id);
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    cond: {
      id: "cond",
      type: "condition",
      conditionLabel: "ok?",
      branches: branches.map((nextId) => ({ label: nextId, nextId })),
    },
    ...branchSteps,
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "cond" });
  return flow.id;
}

describe("dropping a branch says what it took with it (fbff9f70)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.mocked(toast.warning).mockClear();
  });

  it("names the count when the branch reached more than one step", () => {
    const flowId = seedCondition(
      {
        a1: { id: "a1", type: "action", next: "a2" },
        a2: { id: "a2", type: "action" },
        b1: { id: "b1", type: "action" },
      },
      ["a1", "b1"],
    );
    const { result } = renderHook(() => useFlowScriptActions(flowId));

    result.current.removeBranch("cond", 0);

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      "The branch went, and the 2 steps only it reached went with it.",
    );
  });

  it("says it in the singular for one step", () => {
    const flowId = seedCondition(
      { a1: { id: "a1", type: "action" }, b1: { id: "b1", type: "action" } },
      ["a1", "b1"],
    );
    const { result } = renderHook(() => useFlowScriptActions(flowId));

    result.current.removeBranch("cond", 0);

    expect(toast.warning).toHaveBeenCalledWith(
      "The branch went, and the step only it reached went with it.",
    );
  });
});
