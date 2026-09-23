import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { dispatchCanvasKeydown, type CanvasKeydownDispatch } from "./dispatchCanvasKeydown";
import { useSelectionShortcuts } from "./useSelectionShortcuts";

function escape(): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
}

function dispatchWith(editHandler: CanvasKeydownDispatch["editHandlers"][number]) {
  return {
    flags: { isCompareMode: false, isPlaying: false, isRecording: false, isFlowPanelOpen: false },
    hasDiagram: true,
    forceSaveToFolder: vi.fn(),
    setCompareVersion: vi.fn(),
    recordingHandler: () => false,
    editHandlers: [editHandler],
    toolHandler: () => false,
  } satisfies CanvasKeydownDispatch;
}

describe("Escape on the canvas", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  /**
   * The canvas listens in the capture phase and claims Escape; a dialog's own
   * Escape listener never ran, so the shortcuts modal would not close.
   */
  it("leaves Escape to an open dialog", async () => {
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    const handler = vi.fn(() => true);
    const event = escape();

    await dispatchCanvasKeydown(event, dispatchWith(handler));

    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("CONTROL: claims Escape when no dialog is open", async () => {
    document.body.innerHTML = '<div role="dialog" data-state="closed"></div>';
    const handler = vi.fn(() => true);
    const event = escape();

    await dispatchCanvasKeydown(event, dispatchWith(handler));

    expect(handler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  /**
   * Writing `selected: false` into React Flow queued a `replace` carrying the
   * node's previous data, which landed after the store render and put the
   * selection ring back. The store is the only thing Escape may clear.
   */
  it("clears the selection and the highlight through the store only", () => {
    const setNodes = vi.fn();
    const partialInstance: Pick<ReactFlowInstance, "setNodes" | "getNodes"> = {
      setNodes,
      getNodes: () => [],
    };
    const reactFlowInstance = partialInstance as ReactFlowInstance;
    const params = {
      diagram: { id: "d" } as Diagram,
      selectedNodeId: "n1",
      selectedEdgeId: "e1",
      reactFlowInstance,
      setSelectedNodeId: vi.fn(),
      setSelectedNodeIds: vi.fn(),
      setSelectedEdgeId: vi.fn(),
      setContextMenu: vi.fn(),
      clearClipboard: vi.fn(),
      clearHighlight: vi.fn(),
      removeElements: vi.fn(),
    };
    const { result } = renderHook(() => useSelectionShortcuts(params));

    expect(result.current(escape())).toBe(true);

    expect(setNodes).not.toHaveBeenCalled();
    expect(params.setSelectedNodeId).toHaveBeenCalledWith(null);
    expect(params.setSelectedNodeIds).toHaveBeenCalledWith(new Set());
    expect(params.setSelectedEdgeId).toHaveBeenCalledWith(null);
    expect(params.clearHighlight).toHaveBeenCalledOnce();
  });
});
