import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import FlowPanel from "./FlowPanel";
import { useFlowViewStore } from "./useFlowViewStore";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * The panel used to be two things at once: a list of flows, and — for whichever
 * one had its chevron open — the whole editor, dropped between two other flows
 * in a 320px column. It is a list now, and these are the assertions that used
 * to say the opposite.
 */
function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Panel", "context");
  store.openDiagram(diagram.id);
  const node = useDiagramStore
    .getState()
    .addComponent("system", "Checkout API", null, { x: 0, y: 0 });
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", next: "s2", componentId: node.id },
    s2: { id: "s2", type: "action", description: "sends the receipt" },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  return { diagramId: diagram.id, flowId: flow.id };
}

function renderPanel(onEditFlow: (flow: Flow) => void = () => {}) {
  return render(
    <ReactFlowProvider>
      <FlowPanel
        onClose={() => {}}
        onPlay={() => {}}
        onStartRecording={() => {}}
        onEditFlow={onEditFlow}
        onGetInsertPosition={() => ({ x: 0, y: 0 })}
      />
    </ReactFlowProvider>,
  );
}

const select = () => fireEvent.click(screen.getByTitle("Select this flow"));

const flowsOf = (diagramId: string) =>
  Object.keys(useDiagramStore.getState().diagrams[diagramId]!.snapshot.flows);

describe("the flows panel lists and selects", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("holds no field of a step, selected or not", () => {
    seed();
    renderPanel();

    expect(screen.queryByText("sends the receipt")).not.toBeInTheDocument();
    select();
    expect(screen.queryByText("sends the receipt")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flow-object")).not.toBeInTheDocument();
    expect(screen.queryByText("Checkout API")).not.toBeInTheDocument();
  });

  it("marks the flow the canvas is numbered from", () => {
    const { flowId } = seed();
    renderPanel();

    select();

    expect(useFlowViewStore.getState().scriptFlowId).toBe(flowId);
    expect(screen.getByTitle(/Selected/)).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the selection when the same flow is chosen again", () => {
    seed();
    renderPanel();

    select();
    fireEvent.click(screen.getAllByTitle(/Selected/)[0]!);

    expect(useFlowViewStore.getState().scriptFlowId).toBeNull();
  });

  it("hands the flow to the editor rather than unfolding one", () => {
    const { flowId } = seed();
    const onEditFlow = vi.fn();
    renderPanel(onEditFlow);

    fireEvent.click(screen.getByTitle("Edit"));

    expect(onEditFlow).toHaveBeenCalledTimes(1);
    expect(onEditFlow.mock.calls[0]![0]).toMatchObject({ id: flowId });
  });
});

describe("the actions a flow carries", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  const openOverflow = () => {
    fireEvent.keyDown(screen.getByTitle("More actions"), { key: "Enter" });
    return screen.getByRole("menu");
  };

  it("leads with the two a flow is opened with", () => {
    seed();
    renderPanel();

    expect(screen.getByTitle("Edit")).toBeInTheDocument();
    expect(screen.getByTitle("Start flow")).toBeInTheDocument();
  });

  it("keeps the other three reachable by name", () => {
    seed();
    renderPanel();

    const menu = openOverflow();

    for (const name of ["Duplicate flow", "Copy Mermaid", "Remove"]) {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    }
    expect(menu).toBeInTheDocument();
  });

  it("still removes the flow from the diagram", () => {
    const { diagramId, flowId } = seed();
    renderPanel();
    openOverflow();

    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

    expect(flowsOf(diagramId)).not.toContain(flowId);
  });
});
