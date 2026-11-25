import { describe, expect, it, vi } from "vitest";
import { dispatchCanvasKeydown, type CanvasKeydownDispatch } from "./dispatchCanvasKeydown";

function dispatchWith(isCanvasLocked: boolean): CanvasKeydownDispatch {
  return {
    flags: {
      isCompareMode: false,
      isPlaying: false,
      isRecording: false,
      isFlowPanelOpen: false,
      isCanvasLocked,
    },
    hasDiagram: true,
    forceSaveToFolder: vi.fn(),
    setCompareVersion: vi.fn(),
    recordingHandler: vi.fn(() => false),
    editHandlers: [vi.fn(() => true)],
    toolHandler: vi.fn(() => true),
  };
}

const keydown = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key, bubbles: true, ...init });

describe("dispatchCanvasKeydown with the canvas locked", () => {
  it("runs no edit or tool shortcut", async () => {
    const dispatch = dispatchWith(true);
    await dispatchCanvasKeydown(keydown("Backspace"), dispatch);
    await dispatchCanvasKeydown(keydown("1"), dispatch);
    expect(dispatch.editHandlers[0]).not.toHaveBeenCalled();
    expect(dispatch.toolHandler).not.toHaveBeenCalled();
  });

  it("runs them once unlocked", async () => {
    const dispatch = dispatchWith(false);
    await dispatchCanvasKeydown(keydown("Backspace"), dispatch);
    expect(dispatch.editHandlers[0]).toHaveBeenCalledOnce();
  });

  it("still saves", async () => {
    const dispatch = dispatchWith(true);
    await dispatchCanvasKeydown(keydown("s", { metaKey: true, ctrlKey: true }), dispatch);
    expect(dispatch.forceSaveToFolder).toHaveBeenCalledOnce();
  });
});
