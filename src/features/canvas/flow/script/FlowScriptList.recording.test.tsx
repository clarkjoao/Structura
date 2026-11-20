import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import type { RecordingContext } from "../flowMode.types";
import { FlowScriptList } from "./FlowScriptList";
import { nextStepLabel } from "./nextStepLabel";

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

describe("the script says where the next click lands", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("puts a dashed line after the main sequence, with the number the click will take", () => {
    renderRecording(
      seed([
        { id: "s1", type: "action", next: "s2", description: "opens" },
        { id: "s2", type: "action", description: "pays" },
      ]),
    );
    expect(screen.getByTestId("script-waiting")).toHaveTextContent("3");
    expect(screen.getByTestId("script-waiting")).toHaveTextContent("waiting for the next click");
  });

  it("puts the line below a condition's branches, not between them and the condition", () => {
    const { container } = renderRecording(seed(BRANCHED));
    const rows = [...container.querySelectorAll("[data-step-id], [data-testid=script-waiting]")];
    expect(rows[rows.length - 1]?.getAttribute("data-testid")).toBe("script-waiting");
    expect(screen.getByTestId("script-waiting")).toHaveTextContent("2");
  });

  it("marks the placeholder itself when the sequence ends on one", () => {
    renderRecording(seed([{ id: "s1", type: "action" }]));
    const waiting = screen.getByTestId("script-waiting");
    expect(waiting).toHaveTextContent("1");
    expect(screen.queryByText("Empty step")).not.toBeInTheDocument();
  });

  it("follows the branch being written", () => {
    renderRecording(seed(BRANCHED));
    fireEvent.click(screen.getAllByTestId("script-branch-target")[0]!);
    expect(screen.getByTestId("script-waiting")).toHaveTextContent("1a.1");
  });
});

describe("nextStepLabel", () => {
  it("counts on along the main sequence and inside a branch", () => {
    expect(nextStepLabel("3")).toBe("4");
    expect(nextStepLabel("2a")).toBe("2a.1");
    expect(nextStepLabel("2a.1")).toBe("2a.2");
    expect(nextStepLabel("2a.1b")).toBe("2a.1b.1");
  });
});
