import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { RecordingStrip } from "./RecordingStrip";

/** The strip over the canvas: a live recording, where the next click lands, undo and finish. */
function seed(steps: FlowStep[]) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Strip", "context");
  store.openDiagram(diagram.id);
  const flow = store.addFlow(diagram.id, "Checkout", "")!;
  const record: Record<string, FlowStep> = {};
  for (const step of steps) record[step.id] = step;
  useDiagramStore.getState().updateFlow(flow.id, { steps: record, entryStepId: steps[0]?.id });
  return flow.id;
}

const TWO: FlowStep[] = [
  { id: "s1", type: "action", next: "s2", description: "a" },
  { id: "s2", type: "action", description: "b" },
];

describe("RecordingStrip", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("says how many steps are recorded and that the main sequence is written", () => {
    render(
      <RecordingStrip
        flowId={seed(TWO)}
        context={{ mode: "trunk" }}
        onUndo={() => {}}
        onBackToTrunk={() => {}}
        onFinish={() => {}}
      />,
    );
    expect(screen.getByTestId("recording-strip")).toHaveTextContent("Recording · 2 steps");
    expect(screen.getByTestId("recording-strip")).toHaveTextContent("main sequence");
    expect(screen.queryByText("Main sequence")).not.toBeInTheDocument();
  });

  it("names the branch being written and offers the way back", () => {
    const onBackToTrunk = vi.fn();
    render(
      <RecordingStrip
        flowId={seed(TWO)}
        context={{ mode: "branch-record", conditionStepId: "c", branchIndex: 1, branchLabel: "no" }}
        onUndo={() => {}}
        onBackToTrunk={onBackToTrunk}
        onFinish={() => {}}
      />,
    );
    expect(screen.getByTestId("recording-strip")).toHaveTextContent("branch “no”");
    fireEvent.click(screen.getByRole("button", { name: /Main sequence/ }));
    expect(onBackToTrunk).toHaveBeenCalledOnce();
  });

  it("undoes and finishes from the canvas", () => {
    const onUndo = vi.fn();
    const onFinish = vi.fn();
    render(
      <RecordingStrip
        flowId={seed(TWO)}
        context={{ mode: "trunk" }}
        onUndo={onUndo}
        onBackToTrunk={() => {}}
        onFinish={onFinish}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Undo last/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("has nothing to undo before the first step", () => {
    render(
      <RecordingStrip
        flowId={seed([])}
        context={{ mode: "trunk" }}
        onUndo={() => {}}
        onBackToTrunk={() => {}}
        onFinish={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Undo last/ })).toBeDisabled();
  });
});
