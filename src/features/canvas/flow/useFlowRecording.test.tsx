import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow } from "@/features/diagram";
import { checkFlowInvariants, computeFlowStepLabels, useDiagramStore } from "@/features/diagram";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { FlowModeProvider, useFlowMode } from "./FlowModeContext";
import type { FlowModeState } from "./flowMode.types";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/** Published from an effect rather than during render, so the harness is a well-behaved component. */
const held: { current: FlowModeState | null } = { current: null };
const api = new Proxy({} as FlowModeState, {
  get: (_target, key) => {
    if (!held.current) throw new Error("the recorder harness has not rendered yet");
    return Reflect.get(held.current, key);
  },
});

function Harness() {
  const flowMode = useFlowMode();
  useEffect(() => {
    held.current = flowMode;
  });
  return null;
}

function mountRecorder() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Recording", "context");
  store.openDiagram(diagram.id);
  render(
    <FlowModeProvider>
      <Harness />
    </FlowModeProvider>,
  );
  const flows = () => useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows;
  const recorded = (): Flow => {
    const flowId = api.recordingFlowId;
    if (!flowId) throw new Error("nothing is being recorded");
    const flow = flows()[flowId];
    if (!flow) throw new Error("the recorded flow is not in the store");
    return flow;
  };
  return { diagramId: diagram.id, flows, recorded };
}

/** label → step id, so an assertion can name a step the way the panel shows it. */
function byLabel(flow: Flow): Record<string, string> {
  const { labels } = computeFlowStepLabels(flow);
  return Object.fromEntries(Object.entries(labels).map(([stepId, label]) => [label, stepId]));
}

describe("recording writes into the store as it goes", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    // `past` is global to the store; each test starts from a clean history so
    // one test's undo cannot change what the next one sees.
    useDiagramStore.setState({ past: [], future: [], _lastUndoRedoAt: 0, _flowSession: null });
  });

  it("has a flow in the store from the first click, not at the end", () => {
    const { recorded, flows } = mountRecorder();
    act(() => api.startRecording());
    const flowId = api.recordingFlowId!;
    expect(flows()[flowId]).toBeDefined();

    act(() => api.onRecordNodeClick("n1"));
    const afterOne = recorded();
    expect(Object.keys(afterOne.steps)).toHaveLength(1);
    expect(Object.values(afterOne.steps)[0]!.componentId).toBe("n1");

    act(() => api.onRecordNodeClick("n2"));
    expect(Object.keys(recorded().steps)).toHaveLength(2);
  });

  it("keeps the mermaid cache in step with the graph while recording", () => {
    const { recorded } = mountRecorder();
    act(() => api.startRecording());
    act(() => api.onRecordNodeClick("n1"));
    expect(recorded().mermaid).not.toBe("");
  });

  it("records into the branch it was told to, and brings the branches back together", () => {
    const { recorded } = mountRecorder();
    act(() => api.startRecording());
    act(() => api.onRecordNodeClick("n1"));
    const conditionId = Object.keys(recorded().steps)[0]!;
    act(() => {
      useDiagramStore
        .getState()
        .convertStepToCondition(recorded().id, conditionId, "paid?", ["yes", "no"]);
    });

    act(() =>
      api.setRecordingContext({
        mode: "branch-record",
        conditionStepId: conditionId,
        branchIndex: 0,
        branchLabel: "yes",
      }),
    );
    act(() => api.onRecordNodeClick("n2"));
    act(() =>
      api.setRecordingContext({
        mode: "branch-record",
        conditionStepId: conditionId,
        branchIndex: 1,
        branchLabel: "no",
      }),
    );
    act(() => api.onRecordNodeClick("n3"));

    act(() => api.setRecordingContext({ mode: "trunk" }));
    act(() => api.onRecordNodeClick("n4"));

    const flow = recorded();
    const labels = byLabel(flow);
    expect(flow.steps[labels["1a"]!]!.componentId).toBe("n2");
    expect(flow.steps[labels["1b"]!]!.componentId).toBe("n3");
    expect(flow.steps[labels["2"]!]!.componentId).toBe("n4");
    expect(flow.steps[labels["1a"]!]!.next).toBe(labels["2"]);
    expect(flow.steps[labels["1b"]!]!.next).toBe(labels["2"]);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("records nothing while the recorder is choosing a branch", () => {
    const { recorded } = mountRecorder();
    act(() => api.startRecording());
    act(() => api.onRecordNodeClick("n1"));
    const conditionId = Object.keys(recorded().steps)[0]!;
    act(() => api.setRecordingContext({ mode: "branch-select", conditionStepId: conditionId }));
    act(() => api.onRecordNodeClick("n2"));
    expect(Object.keys(recorded().steps)).toHaveLength(1);
  });

  it("takes the whole recording back with one undo", () => {
    const { flows } = mountRecorder();
    act(() => api.startRecording());
    const flowId = api.recordingFlowId!;
    act(() => api.onRecordNodeClick("n1"));
    act(() => api.onRecordNodeClick("n2"));
    act(() => api.onRecordNodeClick("n3"));
    act(() => api.finalizeRecording());

    expect(flows()[flowId]).toBeDefined();
    act(() => useDiagramStore.getState().undo());
    expect(flows()[flowId]).toBeUndefined();
  });

  it("throws away a cancelled recording", () => {
    const { flows } = mountRecorder();
    act(() => api.startRecording());
    const flowId = api.recordingFlowId!;
    act(() => api.onRecordNodeClick("n1"));
    act(() => api.onRecordNodeClick("n2"));
    act(() => api.cancelRecording());

    expect(flows()[flowId]).toBeUndefined();
    expect(api.isRecording).toBe(false);
  });

  it("names a flow that was finished without one", () => {
    const { flows } = mountRecorder();
    act(() => api.startRecording());
    const flowId = api.recordingFlowId!;
    act(() => api.onRecordNodeClick("n1"));
    act(() => api.finalizeRecording());
    expect(flows()[flowId]!.name).toBe(i18n.t("flows.unnamed"));
  });

  it("empties the first step instead of removing it when undoing back to the start", () => {
    const { recorded } = mountRecorder();
    act(() => api.startRecording());
    act(() => api.onRecordNodeClick("n1"));
    act(() => api.onRecordUndo());
    const flow = recorded();
    expect(Object.keys(flow.steps)).toHaveLength(1);
    expect(Object.values(flow.steps)[0]!.componentId).toBeUndefined();
  });

  it("removes the last step and sews the graph when undoing further along", () => {
    const { recorded } = mountRecorder();
    act(() => api.startRecording());
    act(() => api.onRecordNodeClick("n1"));
    act(() => api.onRecordNodeClick("n2"));
    act(() => api.onRecordUndo());
    const flow = recorded();
    expect(Object.keys(flow.steps)).toHaveLength(1);
    expect(Object.values(flow.steps)[0]!.componentId).toBe("n1");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("still opens a checkpoint when a recording starts right after an undo", () => {
    const { flows } = mountRecorder();
    // The undo/redo cooldown suppresses ordinary checkpoints for a moment
    // after a real undo. A session boundary that skipped itself here would
    // leave the recording with nothing to go back to, and cancelling it would
    // keep what it wrote.
    act(() => useDiagramStore.getState().addComponent("system", "N1", null, { x: 0, y: 0 }));
    act(() => useDiagramStore.getState().undo());
    expect(useDiagramStore.getState()._lastUndoRedoAt).toBeGreaterThan(0);
    act(() => api.startRecording());
    const flowId = api.recordingFlowId!;
    act(() => api.onRecordNodeClick("n1"));
    act(() => api.cancelRecording());
    expect(flows()[flowId]).toBeUndefined();
  });

  it("edits an existing flow in place, and cancelling puts it back", () => {
    const { flows, diagramId } = mountRecorder();
    const store = useDiagramStore.getState();
    const existing = store.addFlow(diagramId, "Existing", "")!;
    store.updateFlow(existing.id, {
      steps: { s1: { id: "s1", type: "action", componentId: "n1" } },
      entryStepId: "s1",
    });
    const before = JSON.stringify(flows()[existing.id]!.steps);

    act(() => api.editFlow(flows()[existing.id]!));
    act(() => api.onRecordNodeClick("n9"));
    expect(Object.keys(flows()[existing.id]!.steps)).toHaveLength(2);

    act(() => api.cancelRecording());
    expect(JSON.stringify(flows()[existing.id]!.steps)).toBe(before);
  });
});

describe("the selection a recording leaves behind ends with it", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useCanvasSelectionStore.getState().clearSelection();
  });

  /** Records two steps by clicking nodes, the way a person does. */
  function recordTwo(diagramId: string): { first: string; last: string } {
    const store = useDiagramStore.getState();
    const first = store.addComponent("system", "A", null, { x: 0, y: 0 }).id;
    const last = useDiagramStore.getState().addComponent("system", "B", null, { x: 1, y: 0 }).id;
    act(() => api.startRecording());
    // The selection lands first, the way a click on the canvas does it: select
    // the node, then record the step. Setting it afterwards would hide a clear
    // that ran inside the recording itself.
    const clickNode = (id: string) =>
      act(() => {
        useCanvasSelectionStore.getState().setSelectedNodeId(id);
        useCanvasSelectionStore.getState().setSelectedNodeIds(new Set([id]));
        api.onRecordNodeClick(id);
      });
    clickNode(first);
    clickNode(last);
    void diagramId;
    return { first, last };
  }

  it("clears what was selected when the recording is finalised", () => {
    const { diagramId } = mountRecorder();
    const { last } = recordTwo(diagramId);
    expect(useCanvasSelectionStore.getState().selectedNodeId).toBe(last);

    act(() => api.finalizeRecording());

    expect(useCanvasSelectionStore.getState().selectedNodeId).toBeNull();
  });

  it("clears it when the recording is cancelled too", () => {
    const { diagramId } = mountRecorder();
    const { last } = recordTwo(diagramId);
    expect(useCanvasSelectionStore.getState().selectedNodeId).toBe(last);

    act(() => api.cancelRecording());

    expect(useCanvasSelectionStore.getState().selectedNodeId).toBeNull();
  });

  it("clears the whole selection, not just its primary member", () => {
    const { diagramId } = mountRecorder();
    recordTwo(diagramId);
    act(() => useCanvasSelectionStore.getState().setSelectedEdgeId("some-edge"));
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBe("some-edge");

    act(() => api.finalizeRecording());

    const selection = useCanvasSelectionStore.getState();
    expect([...selection.selectedNodeIds]).toEqual([]);
    expect(selection.selectedEdgeId).toBeNull();
  });

  it("leaves the selection alone while the recording is still running", () => {
    const { diagramId } = mountRecorder();
    const { last } = recordTwo(diagramId);

    expect(useCanvasSelectionStore.getState().selectedNodeId).toBe(last);
    expect(api.isRecording).toBe(true);
  });

  it("does not clear a selection made outside any recording", () => {
    mountRecorder();
    const loose = useDiagramStore.getState().addComponent("system", "C", null, { x: 2, y: 0 }).id;
    useCanvasSelectionStore.getState().setSelectedNodeId(loose);
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set([loose]));

    // No recording is open, so both exits are no-ops and must stay that way.
    act(() => api.finalizeRecording());
    act(() => api.cancelRecording());

    expect(useCanvasSelectionStore.getState().selectedNodeId).toBe(loose);
  });

  it("still finishes the flow it was recording", () => {
    const { diagramId, flows } = mountRecorder();
    recordTwo(diagramId);
    const flowId = api.recordingFlowId!;

    act(() => api.finalizeRecording());

    expect(Object.keys(flows()[flowId]!.steps)).toHaveLength(2);
    expect(api.isRecording).toBe(false);
  });
});
