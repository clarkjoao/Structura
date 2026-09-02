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
 * A flow whose second step points at a component the diagram does not have.
 * That is what the broken-flow dialog exists for, and it is the only way into
 * the repair the dialog offers.
 */
function seedBrokenFlow() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Scene safety", "context");
  store.openDiagram(diagram.id);
  const node = useDiagramStore.getState().addComponent("system", "Gateway", null, { x: 0, y: 0 });
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", next: "s2", componentId: node.id },
    s2: { id: "s2", type: "action", next: "s3", componentId: "el-never-existed" },
    s3: { id: "s3", type: "action", description: "answers" },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  return { diagramId: diagram.id, flowId: flow.id };
}

function enterScene(name: string): string {
  const scene = useDiagramStore.getState().addScene(name);
  useDiagramStore.getState().setActiveScene(scene.id);
  return scene.id;
}

function renderPanel(onPlay: (...args: unknown[]) => void = () => {}) {
  return render(
    <ReactFlowProvider>
      <FlowPanel
        onClose={() => {}}
        onPlay={onPlay}
        onStartRecording={() => {}}
        onEditFlow={() => {}}
        onGetInsertPosition={() => ({ x: 0, y: 0 })}
      />
    </ReactFlowProvider>,
  );
}

function openBrokenDialog() {
  fireEvent.click(screen.getByTitle("Start flow"));
  return screen.getByRole("button", { name: "Remove invalid steps and start" });
}

function stepIdsOf(flowId: string): string[] {
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[state.activeDiagramId!]!;
  return Object.keys(diagram.snapshot.flows[flowId]!.steps).sort();
}

describe("repairing a broken flow from inside a scene", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("offers the repair when no scene is in view", () => {
    const { flowId } = seedBrokenFlow();
    renderPanel();

    const repair = openBrokenDialog();

    expect(repair).toBeEnabled();
    expect(screen.queryByTestId("broken-flow-scene-block")).not.toBeInTheDocument();
    fireEvent.click(repair);
    expect(stepIdsOf(flowId)).toEqual(["s1", "s3"]);
  });

  it("offers the repair when the diagram has a scene that is not in view", () => {
    const { flowId } = seedBrokenFlow();
    enterScene("Q3 proposal");
    useDiagramStore.getState().setActiveScene(null);
    renderPanel();

    const repair = openBrokenDialog();

    expect(repair).toBeEnabled();
    fireEvent.click(repair);
    expect(stepIdsOf(flowId)).toEqual(["s1", "s3"]);
  });

  it("refuses the repair while a scene is in view", () => {
    seedBrokenFlow();
    enterScene("Q3 proposal");
    renderPanel();

    const repair = openBrokenDialog();

    expect(repair).toBeDisabled();
  });

  it("says why it refuses, naming the scene", () => {
    seedBrokenFlow();
    enterScene("Q3 proposal");
    renderPanel();
    openBrokenDialog();

    const block = screen.getByTestId("broken-flow-scene-block");
    expect(block).toHaveTextContent("would edit the flow in the base model");
    expect(block).toHaveTextContent("Q3 proposal");
  });

  it("says what to do instead of refusing and stopping there", () => {
    seedBrokenFlow();
    enterScene("Q3 proposal");
    renderPanel();
    openBrokenDialog();

    expect(screen.getByTestId("broken-flow-scene-block")).toHaveTextContent("Leave the scene");
  });

  it("leaves the base flow untouched when the refused button is clicked", () => {
    const { flowId } = seedBrokenFlow();
    enterScene("Q3 proposal");
    renderPanel();

    fireEvent.click(openBrokenDialog());

    expect(stepIdsOf(flowId)).toEqual(["s1", "s2", "s3"]);
  });
});
