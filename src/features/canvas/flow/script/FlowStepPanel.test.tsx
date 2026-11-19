import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useFlowScriptActions } from "../useFlowScriptActions";
import { FlowStepPanel } from "./FlowStepPanel";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * A step in its own panel: the inspector's anatomy, the step's name in the header, its fields in
 * folding sections. The fields used to unfold inside the script row.
 */
function seed(build: (ids: { connectionId: string; componentId: string }) => FlowStep[]) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Step", "context");
  store.openDiagram(diagram.id);
  const from = useDiagramStore.getState().addComponent("system", "Web", null, { x: 0, y: 0 });
  const to = useDiagramStore.getState().addComponent("system", "API", null, { x: 200, y: 0 });
  const connection = useDiagramStore.getState().addConnection(from.id, to.id, "REST")!;
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps = build({ connectionId: connection.id, componentId: from.id });
  useDiagramStore.getState().updateFlow(flow.id, {
    steps: Object.fromEntries(steps.map((step) => [step.id, step])),
    entryStepId: steps[0]!.id,
  });
  const read = (): Flow =>
    useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]!;
  return { read };
}

const onBack = vi.fn();

function renderStep(read: () => Flow, stepId: string) {
  function Harness() {
    const flow = useDiagramStore(
      (state) => state.diagrams[state.activeDiagramId!]!.snapshot.flows[read().id] as Flow,
    );
    const actions = useFlowScriptActions(flow.id);
    const [open, setOpen] = useState(stepId);
    return (
      <FlowStepPanel
        key={open}
        flow={flow}
        stepId={open}
        actions={actions}
        onBack={onBack}
        onOpenStep={setOpen}
      />
    );
  }
  return render(<Harness />);
}

/** Opens a folded section by its title. */
function unfold(title: string) {
  // A folded section's name carries its summary ("Data empty"), so the title is matched as a prefix.
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${title}`) }));
}

const CALL = ({ connectionId }: { connectionId: string }): FlowStep[] => [
  { id: "s1", type: "action", connectionId },
];

const CHAIN = ({ componentId }: { componentId: string }): FlowStep[] => [
  { id: "s1", type: "action", next: "s2", componentId },
  { id: "s2", type: "action", next: "s3", description: "signs in" },
  { id: "s3", type: "action", description: "sees the dashboard" },
];

const BRANCHED = (): FlowStep[] => [
  { id: "s1", type: "action", next: "c", description: "submits" },
  {
    id: "c",
    type: "condition",
    conditionLabel: "paid?",
    branches: [
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "b1" },
      { label: "later", nextId: "m1" },
    ],
  },
  { id: "a1", type: "action", next: "a2", description: "ships" },
  { id: "a2", type: "action", description: "invoices" },
  { id: "b1", type: "action", description: "declines" },
  { id: "m1", type: "action", description: "waits" },
];

beforeEach(async () => {
  await i18n.changeLanguage("en");
  onBack.mockClear();
});

describe("the step's name is the panel's name", () => {
  it("writes the title from the header, on blur", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s1");
    const name = screen.getByRole("textbox", { name: "Name" });

    fireEvent.change(name, { target: { value: "Client asks for a short link" } });
    fireEvent.blur(name);

    expect(read().steps.s1!.title).toBe("Client asks for a short link");
  });

  it("offers what the step points at as the name until one is written", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s1");

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("placeholder", "Web");
  });

  it("drops the title when it is cleared, rather than storing an empty string", () => {
    const { read } = seed((ids) => [{ ...CHAIN(ids)[0]!, next: undefined, title: "Kept" }]);
    renderStep(read, "s1");
    const name = screen.getByRole("textbox", { name: "Name" });

    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);

    expect(read().steps.s1!.title).toBeUndefined();
  });

  it("names a condition by its question", () => {
    const { read } = seed(BRANCHED);
    renderStep(read, "c");

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("paid?");
    expect(screen.getByText("Branch point 2")).toBeInTheDocument();
  });
});

describe("what the reader sees comes first", () => {
  it("writes the note for the reader", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s1");

    fireEvent.change(screen.getByPlaceholderText("Note for the reader (optional)"), {
      target: { value: "Only the happy path." },
    });

    expect(read().steps.s1!.note).toBe("Only the happy path.");
  });

  it("writes the description beside the note, since the reading shows it too", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s2");

    fireEvent.change(screen.getByPlaceholderText("Step description..."), {
      target: { value: "signs in with SSO" },
    });

    expect(read().steps.s2!.description).toBe("signs in with SSO");
  });
});

describe("a call is asked direction first, then route, then time", () => {
  /** The labels above the fields, in the order they appear on screen. */
  function labelsInOrder(container: HTMLElement, wanted: string[]): string[] {
    const seen: string[] = [];
    for (const node of container.querySelectorAll("span, label")) {
      const text = node.textContent?.trim() ?? "";
      if (wanted.includes(text) && !seen.includes(text)) seen.push(text);
    }
    return seen;
  }

  it("asks the direction first, async with the duration, and the bodies last", () => {
    const { read } = seed(CALL);
    const { container } = renderStep(read, "s1");
    unfold("Data");

    expect(
      labelsInOrder(container, ["Direction", "Route", "Duration", "async", "Body", "Expects back"]),
    ).toEqual(["Direction", "Route", "Duration", "async", "Body", "Expects back"]);
  });

  it("sets the direction from the buttons", () => {
    const { read } = seed(CALL);
    renderStep(read, "s1");

    fireEvent.click(screen.getByText("← Response"));

    expect(read().steps.s1!.payloadDirection).toBe("response");
  });

  it("drops the shape expected back when the step is the answer", () => {
    const { read } = seed((ids) => [{ ...CALL(ids)[0]!, payloadDirection: "response" }]);
    renderStep(read, "s1");
    unfold("Data");

    expect(screen.getByTestId("step-payload")).toBeInTheDocument();
    expect(screen.queryByTestId("step-context-expects")).not.toBeInTheDocument();
  });

  it("keeps the two bodies next to each other", () => {
    const { read } = seed(CALL);
    renderStep(read, "s1");
    unfold("Data");

    const body = screen.getByTestId("step-payload");
    const expects = screen.getByTestId("step-context-expects");
    expect(body.compareDocumentPosition(expects) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("summarises the folded call as the call and where it lands", () => {
    const { read } = seed(CALL);
    renderStep(read, "s1");
    unfold("Call");

    expect(screen.getByRole("button", { name: /Call/ })).toHaveTextContent("REST → API");
  });
});

describe("a branch point's ways out", () => {
  it("renames a way out without moving anything", () => {
    const { read } = seed(BRANCHED);
    renderStep(read, "c");

    fireEvent.change(screen.getByDisplayValue("no"), { target: { value: "declined" } });

    const branches = read().steps.c!.branches!;
    expect(branches.map((branch) => branch.label)).toEqual(["yes", "declined", "later"]);
    expect(branches.map((branch) => branch.nextId)).toEqual(["a1", "b1", "m1"]);
  });

  it("writes the kind the author picks and leaves the question alone", () => {
    const { read } = seed(BRANCHED);
    renderStep(read, "c");

    fireEvent.change(screen.getByLabelText("What this branch point is"), {
      target: { value: "par" },
    });

    expect(read().steps.c!.conditionKind).toBe("par");
    expect(read().steps.c!.conditionLabel).toBe("paid?");
  });

  it("takes the steps only a removed way out reached", () => {
    const { read } = seed(BRANCHED);
    renderStep(read, "c");

    fireEvent.click(screen.getAllByTitle("Remove branch")[0]!);

    expect(read().steps.a1).toBeUndefined();
    expect(read().steps.a2).toBeUndefined();
  });
});

describe("moving between steps", () => {
  it("walks the script with ‹ ›, in its own order", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s1");

    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("goes back to the flow", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s1");

    fireEvent.click(screen.getByRole("button", { name: /Flow/ }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows the object as it stands at this step, folded", () => {
    const { read } = seed(CHAIN);
    renderStep(read, "s1");

    expect(screen.queryByTestId("flow-object")).not.toBeInTheDocument();
    unfold("Object at this step");
    expect(
      within(screen.getByTestId("flow-step-panel")).getByTestId("flow-object"),
    ).toBeInTheDocument();
  });
});
