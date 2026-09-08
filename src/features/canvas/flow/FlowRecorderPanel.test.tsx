import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import FlowRecorderPanel from "./FlowRecorderPanel";
import { useFlowViewStore } from "./useFlowViewStore";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * The panel a flow is written in.
 *
 * It is where the script has always had room; what is new is that it is the
 * only place, and that the four fields describing the flow itself no longer
 * hold a fifth of it open to say what was written once.
 */
function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Editor", "context");
  store.openDiagram(diagram.id);
  const node = useDiagramStore
    .getState()
    .addComponent("system", "Checkout API", null, { x: 0, y: 0 });
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: {
      id: "s1",
      type: "action",
      next: "s2",
      componentId: node.id,
      context: { sets: { slug: "artigo26" } },
    },
    s2: { id: "s2", type: "action", description: "sends the receipt" },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  const read = () => useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]!;
  return { flowId: flow.id, read };
}

function renderPanel(flowId: string, isEditing: boolean) {
  return render(
    <FlowRecorderPanel
      flowId={flowId}
      recordingContext={{ mode: "trunk" }}
      setRecordingContext={() => {}}
      onCancel={() => {}}
      onFinalize={() => {}}
      isEditing={isEditing}
    />,
  );
}

describe("the panel a flow is written in", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("holds the script, which is why it exists", () => {
    const { flowId } = seed();
    renderPanel(flowId, true);

    expect(screen.getByText("Checkout API")).toBeInTheDocument();
    expect(screen.getByText("sends the receipt")).toBeInTheDocument();
    expect(screen.getByTestId("flow-object")).toBeInTheDocument();
  });

  it("opens a stored flow with its own fields folded, and its name out", () => {
    const { flowId } = seed();
    renderPanel(flowId, true);

    expect(screen.getByDisplayValue("Checkout")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Flow description (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
  });

  it("opens a new recording with them showing, since nothing is written yet", () => {
    const { flowId } = seed();
    renderPanel(flowId, false);

    expect(screen.getByPlaceholderText("Flow description (optional)")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("writes the description once the fold is opened", () => {
    const { flowId, read } = seed();
    renderPanel(flowId, true);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.change(screen.getByPlaceholderText("Flow description (optional)"), {
      target: { value: "the happy path" },
    });

    expect(read().description).toBe("the happy path");
  });
});
