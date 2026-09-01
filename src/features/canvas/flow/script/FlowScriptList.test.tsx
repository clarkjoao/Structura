import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { checkFlowInvariants, useDiagramStore } from "@/features/diagram";
import { FlowScriptList } from "./FlowScriptList";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
const { toast } = await import("sonner");

/**
 * Seeds the shared store with a diagram holding one flow of the given shape,
 * and returns a reader for it. The panel reads the store, so the fixture has to
 * live there rather than in a prop.
 */
function seedFlow(steps: FlowStep[], entryStepId = steps[0]?.id) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Script", "context");
  store.openDiagram(diagram.id);
  const created = store.addFlow(diagram.id, "Checkout", "");
  if (!created) throw new Error("addFlow returned null");
  const record: Record<string, FlowStep> = {};
  for (const step of steps) record[step.id] = step;
  useDiagramStore.getState().updateFlow(created.id, { steps: record, entryStepId });
  const read = (): Flow => {
    const flow = useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[created.id];
    if (!flow) throw new Error("flow is gone");
    return flow;
  };
  return { flowId: created.id, diagramId: diagram.id, read };
}

/** Renders the panel and re-renders it whenever the store's copy of the flow changes. */
function renderScript(read: () => Flow) {
  function Harness() {
    const flow = useDiagramStore(
      (state) =>
        state.diagrams[state.activeDiagramId!]!.snapshot.flows[read().id] as Flow | undefined,
    );
    if (!flow) return null;
    return <FlowScriptList flow={flow} />;
  }
  return render(<Harness />);
}

const CHAIN: FlowStep[] = [
  { id: "s1", type: "action", next: "s2", description: "opens the app" },
  { id: "s2", type: "action", next: "s3", description: "signs in" },
  { id: "s3", type: "action", description: "sees the dashboard" },
];

const BRANCHED: FlowStep[] = [
  { id: "s1", type: "action", next: "c", description: "submits" },
  {
    id: "c",
    type: "condition",
    conditionLabel: "paid?",
    branches: [
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "b1" },
    ],
  },
  { id: "a1", type: "action", next: "join", description: "ships" },
  { id: "b1", type: "action", next: "join", description: "declines" },
  { id: "join", type: "action", description: "notifies" },
];

describe("FlowScriptList", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.mocked(toast.warning).mockClear();
  });

  it("shows one row per step, numbered off the graph", () => {
    const { read } = seedFlow(CHAIN);
    renderScript(read);
    expect(screen.getByText("opens the app")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("numbers the branches and the step where they meet again", () => {
    const { read } = seedFlow(BRANCHED);
    renderScript(read);
    expect(screen.getByText("2a")).toBeInTheDocument();
    expect(screen.getByText("2b")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("ships")).toBeInTheDocument();
  });

  it("indents a branch under the condition that opens it", () => {
    const { read } = seedFlow(BRANCHED);
    const { container } = renderScript(read);
    // Read the wrapper the indentation is actually applied to, by step id: the
    // row inside it carries a style of its own, and `closest("div[style]")`
    // would stop there and read a padding that is never set.
    const indentOf = (stepId: string) => {
      const wrapper = container.querySelector(`[data-step-id="${stepId}"]`) as HTMLElement;
      return wrapper.style.paddingLeft;
    };
    expect(indentOf("c")).toBe("0px");
    expect(indentOf("a1")).toBe("14px");
    expect(indentOf("b1")).toBe("14px");
    expect(indentOf("join")).toBe("0px");
  });

  it("writes a description straight into the stored flow", () => {
    const { read } = seedFlow(CHAIN);
    renderScript(read);
    fireEvent.click(screen.getByText("signs in"));
    const input = screen.getByPlaceholderText("Step description...");
    fireEvent.change(input, { target: { value: "signs in with SSO" } });
    expect(read().steps.s2!.description).toBe("signs in with SSO");
  });

  it("sews the graph shut when a step is removed", () => {
    const { read } = seedFlow(CHAIN);
    renderScript(read);
    fireEvent.click(screen.getAllByTitle("Remove step")[1]!);
    const flow = read();
    expect(flow.steps.s2).toBeUndefined();
    expect(flow.steps.s1!.next).toBe("s3");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("says why it will not remove a condition, and leaves the flow alone", () => {
    const { read } = seedFlow(BRANCHED);
    renderScript(read);
    const before = JSON.stringify(read().steps);
    fireEvent.click(screen.getAllByTitle("Remove step")[1]!);
    expect(JSON.stringify(read().steps)).toBe(before);
    expect(toast.warning).toHaveBeenCalled();
  });

  it("renames a branch without moving anything", () => {
    const { read } = seedFlow(BRANCHED);
    renderScript(read);
    fireEvent.click(screen.getByText("◇ paid?"));
    const input = screen.getByDisplayValue("no");
    fireEvent.change(input, { target: { value: "declined" } });
    const branches = read().steps.c!.branches!;
    expect(branches.map((branch) => branch.label)).toEqual(["yes", "declined"]);
    expect(branches.map((branch) => branch.nextId)).toEqual(["a1", "b1"]);
  });

  it("adds an empty step right after the one asked for", () => {
    const { read } = seedFlow(CHAIN);
    renderScript(read);
    fireEvent.click(screen.getAllByTitle("Add a step after this one")[0]!);
    const flow = read();
    expect(flow.steps.s1!.next).not.toBe("s2");
    expect(flow.steps[flow.steps.s1!.next!]!.next).toBe("s2");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("says how many steps nothing reaches instead of hiding them", () => {
    const { read } = seedFlow([...CHAIN, { id: "lost", type: "action", description: "orphan" }]);
    renderScript(read);
    expect(screen.queryByText("orphan")).not.toBeInTheDocument();
    expect(screen.getByText(/not reachable from the start/)).toBeInTheDocument();
  });
});
