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
        onFork={() => true}
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
        onFork={() => true}
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
        onFork={() => true}
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
        onFork={() => true}
        onBackToTrunk={() => {}}
        onFinish={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Undo last/ })).toBeDisabled();
  });

  it("forks the flow from the strip with yes / no by default, on Enter", () => {
    const onFork = vi.fn(() => true);
    render(
      <RecordingStrip
        flowId={seed(TWO)}
        context={{ mode: "trunk" }}
        onUndo={() => {}}
        onFork={onFork}
        onBackToTrunk={() => {}}
        onFinish={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Condition/ }));
    const question = screen.getByRole("textbox", { name: "Question" });
    fireEvent.change(question, { target: { value: "paid?" } });
    fireEvent.keyDown(question, { key: "Enter" });

    expect(onFork).toHaveBeenCalledWith("paid?", ["Yes", "No"]);
    expect(screen.queryByTestId("recording-fork-form")).not.toBeInTheDocument();
  });

  it("keeps the fork open when the flow refuses it", () => {
    render(
      <RecordingStrip
        flowId={seed(TWO)}
        context={{ mode: "trunk" }}
        onUndo={() => {}}
        onFork={() => false}
        onBackToTrunk={() => {}}
        onFinish={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Condition/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fork" }));
    expect(screen.getByTestId("recording-fork-form")).toBeInTheDocument();
  });

  it("says it is editing, not recording, a flow that already existed", () => {
    render(
      <RecordingStrip
        flowId={seed(TWO)}
        context={{ mode: "trunk" }}
        isEditing
        onUndo={() => {}}
        onFork={() => true}
        onBackToTrunk={() => {}}
        onFinish={() => {}}
      />,
    );
    expect(screen.getByTestId("recording-strip")).toHaveTextContent("Editing · 2 steps");
  });
});
