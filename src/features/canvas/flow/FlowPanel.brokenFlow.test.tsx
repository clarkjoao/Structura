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

/**
 * A flow reaching across the scene boundary: `s2` names a component that only
 * exists inside a closed scene, and — unless `onlySceneHeld` — `s3` names one
 * that exists nowhere at all. From outside the scene the two look identical.
 */
function seedFlowReachingIntoScene(opts: { onlySceneHeld?: boolean } = {}) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Scene safety", "context");
  store.openDiagram(diagram.id);
  const gateway = useDiagramStore
    .getState()
    .addComponent("system", "Gateway", null, { x: 0, y: 0 });
  const sceneId = enterScene("Q3 proposal");
  const cache = useDiagramStore.getState().addComponent("system", "Cache", null, { x: 200, y: 0 });
  useDiagramStore.getState().setActiveScene(null);
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", next: "s2", componentId: gateway.id },
    s2: { id: "s2", type: "action", next: "s3", componentId: cache.id },
    s3: opts.onlySceneHeld
      ? { id: "s3", type: "action", next: "s4", componentId: gateway.id }
      : { id: "s3", type: "action", next: "s4", componentId: "el-never-existed" },
    s4: { id: "s4", type: "action", description: "answers" },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  return { flowId: flow.id, sceneId, cacheId: cache.id };
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

    expect(screen.getByText(/were removed from the diagram/)).toBeInTheDocument();
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

describe("repairing a flow whose steps reach into a closed scene", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("removes only the step whose element is nowhere, keeping the scene's", () => {
    const { flowId } = seedFlowReachingIntoScene();
    renderPanel();

    const repair = openBrokenDialog();

    expect(repair).toBeEnabled();
    fireEvent.click(repair);
    expect(stepIdsOf(flowId)).toEqual(["s1", "s2", "s4"]);
  });

  it("starts the flow it just repaired", () => {
    const onPlay = vi.fn();
    seedFlowReachingIntoScene();
    renderPanel(onPlay);

    fireEvent.click(openBrokenDialog());

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(Object.keys(onPlay.mock.calls[0]![0].steps).sort()).toEqual(["s1", "s2", "s4"]);
  });

  it("marks the kept step with the scene that holds its component", () => {
    seedFlowReachingIntoScene();
    renderPanel();
    openBrokenDialog();

    expect(screen.getByText("in scene “Q3 proposal”")).toBeInTheDocument();
  });

  it("says the marked steps are kept, naming the scene", () => {
    seedFlowReachingIntoScene();
    renderPanel();
    openBrokenDialog();

    const block = screen.getByTestId("broken-flow-kept-block");
    expect(block).toHaveTextContent("They are kept, not removed");
    expect(block).toHaveTextContent("live only in “Q3 proposal”.");
  });

  it("says what to do about them instead of stopping at the refusal", () => {
    seedFlowReachingIntoScene();
    renderPanel();
    openBrokenDialog();

    expect(screen.getByTestId("broken-flow-kept-block")).toHaveTextContent("Open the scene");
  });

  it("does not tell the reader every element was removed from the diagram", () => {
    seedFlowReachingIntoScene();
    renderPanel();
    openBrokenDialog();

    expect(screen.queryByText(/were removed from the diagram/)).not.toBeInTheDocument();
    expect(screen.getByText(/elements the current view does not have/)).toBeInTheDocument();
  });

  it("does not call a step removed when the scene still has its component", () => {
    seedFlowReachingIntoScene();
    renderPanel();
    openBrokenDialog();

    expect(screen.queryAllByText("component removed")).toHaveLength(1);
  });
});

describe("when every invalid step reaches into a closed scene", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
  });

  it("offers no repair, because there is nothing to remove", () => {
    seedFlowReachingIntoScene({ onlySceneHeld: true });
    renderPanel();

    expect(openBrokenDialog()).toBeDisabled();
  });

  it("says that is why, naming the scene", () => {
    seedFlowReachingIntoScene({ onlySceneHeld: true });
    renderPanel();
    openBrokenDialog();

    const block = screen.getByTestId("broken-flow-kept-block");
    expect(block).toHaveTextContent("Nothing to remove");
    expect(block).toHaveTextContent("Q3 proposal");
  });

  it("leaves the flow whole when the refused button is clicked", () => {
    const { flowId } = seedFlowReachingIntoScene({ onlySceneHeld: true });
    renderPanel();

    fireEvent.click(openBrokenDialog());

    expect(stepIdsOf(flowId)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("does not start the flow behind the refusal", () => {
    const onPlay = vi.fn();
    seedFlowReachingIntoScene({ onlySceneHeld: true });
    renderPanel(onPlay);

    fireEvent.click(openBrokenDialog());

    expect(onPlay).not.toHaveBeenCalled();
  });
});
