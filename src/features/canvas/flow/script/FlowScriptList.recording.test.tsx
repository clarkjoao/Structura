import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import type { RecordingContext } from "../flowMode.types";
import { FlowScriptList } from "./FlowScriptList";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * Branches are written from the script: each branch's first row is a place the recorder can be
 * pointed at, with no screen in between.
 */
function seed(steps: FlowStep[]) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Script", "context");
  store.openDiagram(diagram.id);
  const created = store.addFlow(diagram.id, "Checkout", "")!;
  const record: Record<string, FlowStep> = {};
  for (const step of steps) record[step.id] = step;
  useDiagramStore.getState().updateFlow(created.id, { steps: record, entryStepId: steps[0]!.id });
  return created.id;
}

let target: RecordingContext = { mode: "trunk" };

function renderRecording(flowId: string) {
  function Harness() {
    const flow = useDiagramStore(
      (state) => state.diagrams[state.activeDiagramId!]!.snapshot.flows[flowId] as Flow,
    );
    const [current, setCurrent] = useState<RecordingContext>({ mode: "trunk" });
    target = current;
    return <FlowScriptList flow={flow} recording={{ target: current, onTarget: setCurrent }} />;
  }
  return render(<Harness />);
}

const BRANCHED: FlowStep[] = [
  {
    id: "c",
    type: "condition",
    conditionLabel: "paid?",
    branches: [
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "b1" },
    ],
  },
  { id: "a1", type: "action", description: "ships" },
  { id: "b1", type: "action", description: "declines" },
];

describe("writing branches from the script", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    target = { mode: "trunk" };
  });

  it("offers every branch as a place to record into", () => {
    renderRecording(seed(BRANCHED));
    expect(screen.getAllByTestId("script-branch-target")).toHaveLength(2);
  });

  it("points the recorder at the chosen branch, and marks it", () => {
    renderRecording(seed(BRANCHED));
    fireEvent.click(screen.getAllByTestId("script-branch-target")[1]!);

    expect(target).toEqual({
      mode: "branch-record",
      conditionStepId: "c",
      branchIndex: 1,
      branchLabel: "no",
    });
    expect(screen.getAllByTestId("script-branch-target")[1]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("goes back to the main sequence when the marked branch is chosen again", () => {
    renderRecording(seed(BRANCHED));
    const second = () => screen.getAllByTestId("script-branch-target")[1]!;
    fireEvent.click(second());
    fireEvent.click(second());

    expect(target).toEqual({ mode: "trunk" });
  });
});
