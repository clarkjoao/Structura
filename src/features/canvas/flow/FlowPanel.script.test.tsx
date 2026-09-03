import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import FlowPanel from "./FlowPanel";
import { useFlowViewStore } from "./useFlowViewStore";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * The script has to be reachable without recording anything: it is where a
 * stored flow is edited, so the flows panel is where it opens.
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
  return { flowId: flow.id };
}

function renderPanel() {
  return render(
    <ReactFlowProvider>
      <FlowPanel
        onClose={() => {}}
        onPlay={() => {}}
        onStartRecording={() => {}}
        onEditFlow={() => {}}
        onGetInsertPosition={() => ({ x: 0, y: 0 })}
      />
    </ReactFlowProvider>,
  );
}

describe("FlowPanel opens the script of a stored flow", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("keeps the script shut until it is asked for", () => {
    seed();
    renderPanel();
    expect(screen.queryByText("sends the receipt")).not.toBeInTheDocument();
  });

  it("shows the numbered rows once the flow is opened", () => {
    seed();
    renderPanel();
    fireEvent.click(screen.getByTitle("Open the script"));
    expect(screen.getByText("Checkout API")).toBeInTheDocument();
    expect(screen.getByText("sends the receipt")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("marks the open flow as the one the canvas is numbered from", () => {
    const { flowId } = seed();
    renderPanel();
    fireEvent.click(screen.getByTitle("Open the script"));
    expect(useFlowViewStore.getState().scriptFlowId).toBe(flowId);
    fireEvent.click(screen.getByTitle("Open the script"));
    expect(useFlowViewStore.getState().scriptFlowId).toBeNull();
  });
});
