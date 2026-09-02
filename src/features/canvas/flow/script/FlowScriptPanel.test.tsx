import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { checkFlowInvariants, computeFlowStepLabels, useDiagramStore } from "@/features/diagram";
import { useCanvasSelectionStore } from "../../hooks/useCanvasSelectionStore";
import { useFlowViewStore } from "../useFlowViewStore";
import { FlowScriptPanel } from "./FlowScriptPanel";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
const { toast } = await import("sonner");

/**
 * Seeds a diagram with three real components and one flow. The steps name the
 * components by their fixture key; `nodes` maps that to the id the store gave
 * them, because a step whose `componentId` matches nothing renders as "?".
 */
function seedFlow(build: (nodes: Record<string, string>) => FlowStep[], entryKey?: string) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Script", "context");
  store.openDiagram(diagram.id);
  const nodes: Record<string, string> = {};
  for (const [key, name] of [
    ["n1", "Storefront"],
    ["n2", "Checkout API"],
    ["n3", "Ledger"],
  ] as const) {
    nodes[key] = useDiagramStore.getState().addComponent("system", name, null, { x: 0, y: 0 }).id;
  }
  const steps = build(nodes).map((step) => ({
    ...step,
    ...(step.componentId ? { componentId: nodes[step.componentId] ?? step.componentId } : {}),
  }));
  const entryStepId = entryKey ?? steps[0]?.id;
  const created = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "");
  if (!created) throw new Error("addFlow returned null");
  const record: Record<string, FlowStep> = {};
  for (const step of steps) record[step.id] = step;
  useDiagramStore.getState().updateFlow(created.id, { steps: record, entryStepId });
  const read = (): Flow => {
    const flow = useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[created.id];
    if (!flow) throw new Error("flow is gone");
    return flow;
  };
  return { read, nodes };
}

function renderPanel(read: () => Flow) {
  function Harness() {
    const flow = useDiagramStore(
      (state) =>
        state.diagrams[state.activeDiagramId!]!.snapshot.flows[read().id] as Flow | undefined,
    );
    if (!flow) return null;
    return <FlowScriptPanel flow={flow} />;
  }
  return render(<Harness />);
}

/** label → step id, so a drag can be written the way the panel reads. */
function labels(flow: Flow): Record<string, string> {
  const { labels: byStep } = computeFlowStepLabels(flow);
  return Object.fromEntries(Object.entries(byStep).map(([id, label]) => [label, id]));
}

function dragRow(container: HTMLElement, fromStepId: string, ontoStepId: string) {
  const rowOf = (stepId: string) =>
    container.querySelector(`[data-step-id="${stepId}"] > div[draggable]`) as HTMLElement;
  const dataTransfer = { effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(rowOf(fromStepId), { dataTransfer });
  fireEvent.dragOver(rowOf(ontoStepId), { dataTransfer });
  fireEvent.drop(rowOf(ontoStepId), { dataTransfer });
}

// Written down back to front on purpose: a test about the order the rows read
// in must not be able to pass on the order they were recorded in.
const CHAIN = (): FlowStep[] => [
  { id: "s3", type: "action", componentId: "n3" },
  { id: "s2", type: "action", next: "s3", componentId: "n2" },
  { id: "s1", type: "action", next: "s2", componentId: "n1" },
];

const BRANCHED = (): FlowStep[] => [
  { id: "s1", type: "action", next: "c", componentId: "n1" },
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

describe("dragging a row moves the step", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.mocked(toast.warning).mockClear();
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("puts a step dragged upwards in front of the row it lands on", () => {
    const { read } = seedFlow(CHAIN, "s1");
    const { container } = renderPanel(read);
    dragRow(container, "s3", "s1");
    const flow = read();
    expect(labels(flow)["1"]).toBe("s3");
    expect(labels(flow)["2"]).toBe("s1");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("puts a step dragged downwards behind the row it lands on", () => {
    const { read } = seedFlow(CHAIN, "s1");
    const { container } = renderPanel(read);
    dragRow(container, "s1", "s3");
    const flow = read();
    expect(labels(flow)["3"]).toBe("s1");
    expect(labels(flow)["1"]).toBe("s2");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("drops a step into the branch whose row it lands on", () => {
    const { read } = seedFlow(BRANCHED);
    const { container } = renderPanel(read);
    dragRow(container, "join", "a1");
    const flow = read();
    expect(flow.steps.c!.branches![0]!.nextId).toBe("join");
    expect(flow.steps.join!.next).toBe("a1");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("refuses to move a condition, and says why", () => {
    const { read } = seedFlow(BRANCHED);
    const { container } = renderPanel(read);
    const before = JSON.stringify(read().steps);
    dragRow(container, "c", "s1");
    expect(JSON.stringify(read().steps)).toBe(before);
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("A condition moves together with its branches"),
    );
  });

  it("refuses a drop directly behind a condition, and says why", () => {
    const { read } = seedFlow(BRANCHED);
    const { container } = renderPanel(read);
    const before = JSON.stringify(read().steps);
    dragRow(container, "s1", "c");
    expect(JSON.stringify(read().steps)).toBe(before);
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("no place directly after a condition"),
    );
  });

  it("does nothing when a row is dropped on itself", () => {
    const { read } = seedFlow(CHAIN, "s1");
    const { container } = renderPanel(read);
    const before = JSON.stringify(read().steps);
    dragRow(container, "s2", "s2");
    expect(JSON.stringify(read().steps)).toBe(before);
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe("the script row and the canvas share one selection", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("selects on the canvas what the row points at", () => {
    const { read, nodes } = seedFlow(CHAIN, "s1");
    renderPanel(read);
    fireEvent.click(screen.getByText("Checkout API"));
    expect(useCanvasSelectionStore.getState().selectedNodeId).toBe(nodes.n2);
    expect(useFlowViewStore.getState().selectedStepId).toBe("s2");
  });

  it("moves to the row for whatever was selected on the canvas", () => {
    const { read, nodes } = seedFlow(CHAIN, "s1");
    renderPanel(read);
    act(() => useCanvasSelectionStore.getState().setSelectedNodeId(nodes.n3!));
    expect(useFlowViewStore.getState().selectedStepId).toBe("s3");
  });

  it("moves to the first row that visits the selected node, not the last", () => {
    const { read, nodes } = seedFlow(() => [
      { id: "s1", type: "action", next: "s2", componentId: "n1" },
      { id: "s2", type: "action", componentId: "n1" },
    ]);
    renderPanel(read);
    act(() => useCanvasSelectionStore.getState().setSelectedNodeId(nodes.n1!));
    expect(useFlowViewStore.getState().selectedStepId).toBe("s1");
  });

  it("forgets the row it was on when a different flow's script opens", () => {
    useFlowViewStore.getState().openScript("flow-a");
    useFlowViewStore.getState().selectStep("s2");
    useFlowViewStore.getState().openScript("flow-a");
    expect(useFlowViewStore.getState().selectedStepId).toBe("s2");
    useFlowViewStore.getState().openScript("flow-b");
    expect(useFlowViewStore.getState().selectedStepId).toBeNull();
  });

  it("stays on the row it is on when that row already points at the selection", () => {
    const { read, nodes } = seedFlow(() => [
      { id: "s1", type: "action", next: "s2", componentId: "n1" },
      { id: "s2", type: "action", componentId: "n1" },
    ]);
    const { container } = renderPanel(read);
    const secondRow = container.querySelector('[data-step-id="s2"] > div[draggable]');
    fireEvent.click(secondRow!);
    expect(useFlowViewStore.getState().selectedStepId).toBe("s2");
    expect(useCanvasSelectionStore.getState().selectedNodeId).toBe(nodes.n1);
  });
});
