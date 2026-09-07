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
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("A condition cannot be removed on its own"),
    );
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

  /**
   * The keyword used to be authorable only by typing it into the question, and
   * nothing on screen said that the word `par` in a label meant anything. This
   * is the path from the panel to the field — the piece itself is tested next
   * door, and testing a piece is no proof that anything reaches it.
   */
  it("writes the kind of branch point the author picks", () => {
    const { read } = seedFlow(BRANCHED);
    renderScript(read);
    fireEvent.click(screen.getByText("◇ paid?"));

    fireEvent.change(screen.getByLabelText("What this branch point is"), {
      target: { value: "par" },
    });

    expect(read().steps.c!.conditionKind).toBe("par");
  });

  it("leaves the question alone when the kind changes", () => {
    const { read } = seedFlow(BRANCHED);
    renderScript(read);
    fireEvent.click(screen.getByText("◇ paid?"));

    fireEvent.change(screen.getByLabelText("What this branch point is"), {
      target: { value: "loop" },
    });

    expect(read().steps.c!.conditionLabel).toBe("paid?");
  });

  it("marks the row with what the branch point is once it is threads", () => {
    const { read } = seedFlow(BRANCHED);
    renderScript(read);
    fireEvent.click(screen.getByText("◇ paid?"));

    fireEvent.change(screen.getByLabelText("What this branch point is"), {
      target: { value: "par" },
    });

    expect(screen.getByText("⇉ paid?")).toBeTruthy();
  });

  it("calls an unnamed branch point what it is rather than nothing", () => {
    const { read } = seedFlow([
      { id: "s1", type: "action", next: "c", description: "enqueues" },
      {
        id: "c",
        type: "condition",
        conditionKind: "par",
        branches: [
          { label: "email", nextId: "a1" },
          { label: "metrics", nextId: "b1" },
        ],
      },
      { id: "a1", type: "action", description: "sends" },
      { id: "b1", type: "action", description: "records" },
    ]);
    renderScript(read);

    expect(screen.getByText("⇉ Parallel")).toBeTruthy();
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

  it("says how many steps a removed branch takes with it", () => {
    // Three branches: the panel only offers to remove one while more than two
    // remain, so a two-branch condition has no remove button to click.
    const { read } = seedFlow([
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
    ]);
    renderScript(read);
    fireEvent.click(screen.getByText("◇ paid?"));
    fireEvent.click(screen.getAllByTitle("Remove branch")[0]!);

    expect(read().steps.a1).toBeUndefined();
    expect(read().steps.a2).toBeUndefined();
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("the 2 steps only it reached"),
    );
  });

  it("says how many steps nothing reaches instead of hiding them", () => {
    const { read } = seedFlow([...CHAIN, { id: "lost", type: "action", description: "orphan" }]);
    renderScript(read);
    expect(screen.queryByText("orphan")).not.toBeInTheDocument();
    expect(screen.getByText(/not reachable from the start/)).toBeInTheDocument();
  });
});

/**
 * The scope the panel offers is the scope the reading will have.
 *
 * These two panels are the same fold given the same path. They stopped being
 * that when the editor folded the path one step shorter: the walk never reached
 * the step, so the call that step answers was never closed, and every value the
 * call was holding stayed on offer while the reading called those keys
 * undefined.
 */
const NESTED_CONTEXT: FlowStep[] = [
  {
    id: "s1",
    type: "action",
    next: "s2",
    connectionId: "c1",
    payloadDirection: "request",
    context: { sets: { slug: "artigo26" } },
  },
  { id: "s2", type: "action", next: "s3", connectionId: "c2", payloadDirection: "request" },
  { id: "s3", type: "action", next: "s4", context: { sets: { linha: "1" } } },
  { id: "s4", type: "action", next: "s5", description: "inside the call" },
  {
    id: "s5",
    type: "action",
    next: "s6",
    connectionId: "c2",
    payloadDirection: "response",
    context: { sets: { short_url: "https://url.sh/artigo26" } },
  },
  { id: "s6", type: "action", connectionId: "c1", payloadDirection: "response" },
];

describe("the state a step is written against", () => {
  const expand = (label: string) => fireEvent.click(screen.getByText(label));
  const scopeText = () => screen.getByTestId("step-context-scope").textContent ?? "";

  it("withholds a value the step's own return takes away", () => {
    const { read } = seedFlow(NESTED_CONTEXT);
    renderScript(read);
    expand("6");

    // `short_url` lives in the call step 6 answers, so it is gone by the time
    // step 6 runs — exactly what the reading reports there.
    expect(scopeText()).toContain("slug");
    expect(scopeText()).not.toContain("short_url");
  });

  it("offers a value to a step that runs before the call holding it ends", () => {
    const { read } = seedFlow(NESTED_CONTEXT);
    renderScript(read);
    expand("4");

    expect(scopeText()).toContain("linha");
    expect(scopeText()).toContain("slug");
  });

  it("says when the values of a call do not outlive it", () => {
    const { read } = seedFlow(NESTED_CONTEXT);
    renderScript(read);
    expand("4");

    // The call is answered at step 5, and `linha` does not survive it.
    expect(screen.getByTestId("step-context-scope-ends").textContent).toContain("5");
  });

  it("has nothing to mark on a group no step ever closes", () => {
    const { read } = seedFlow([
      { id: "s1", type: "action", next: "s2", context: { sets: { slug: "a" } } },
      { id: "s2", type: "action", description: "plain" },
    ]);
    renderScript(read);
    expand("2");

    expect(scopeText()).toContain("slug");
    expect(screen.queryByTestId("step-context-scope-ends")).toBeNull();
  });
});

/**
 * A claim about what happens after a step has to hold on the reader's own way
 * through.
 *
 * The marker said where a call is answered by scanning the whole script, so a
 * call answered inside one branch was announced to someone writing the other —
 * a branch that never reaches it. Same class of claim as the scope bug this
 * panel was rebuilt to stop making.
 */
const ANSWERED_IN_ONE_BRANCH: FlowStep[] = [
  { id: "s1", type: "action", next: "s2", connectionId: "c1", payloadDirection: "request" },
  { id: "s2", type: "action", next: "s3", context: { sets: { linha: "1" } } },
  { id: "s3", type: "action", next: "c", description: "dentro da chamada" },
  {
    id: "c",
    type: "condition",
    conditionLabel: "respondeu?",
    branches: [
      { label: "sim", nextId: "a1" },
      { label: "nao", nextId: "b1" },
    ],
  },
  { id: "a1", type: "action", connectionId: "c1", payloadDirection: "response" },
  { id: "b1", type: "action", description: "segue sem resposta" },
];

describe("saying when a call's values run out", () => {
  const expand = (label: string) => fireEvent.click(screen.getByText(label));

  it("names the step that answers, on the way that reaches it", () => {
    const { read } = seedFlow(ANSWERED_IN_ONE_BRANCH);
    renderScript(read);
    expand("dentro da chamada");

    expect(screen.getByTestId("step-context-scope").textContent).toContain("linha");
    expect(screen.getByTestId("step-context-scope-ends")).toBeInTheDocument();
  });

  it("says nothing on a way that never reaches the answer", () => {
    const { read } = seedFlow(ANSWERED_IN_ONE_BRANCH);
    renderScript(read);
    expand("segue sem resposta");

    expect(screen.getByTestId("step-context-scope").textContent).toContain("linha");
    expect(screen.queryByTestId("step-context-scope-ends")).toBeNull();
  });
});
