import { describe, expect, it, vi } from "vitest";
import {
  handleAutoLayoutShortcut,
  handleSaveShortcut,
  isCanvasEditingLocked,
  isCanvasOverlayOpen,
} from "./canvasKeydownGates";

function modEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, metaKey: true, bubbles: true, ...init });
}

describe("canvasKeydownGates", () => {
  it("locks editing during flow / play / compare / record", () => {
    expect(
      isCanvasEditingLocked({
        isCompareMode: false,
        isPlaying: false,
        isRecording: false,
        isFlowPanelOpen: true,
      }),
    ).toBe(true);
  });

  it("treats search and palette as overlays", () => {
    expect(
      isCanvasOverlayOpen({
        isCompareMode: false,
        isPlaying: false,
        isRecording: false,
        isFlowPanelOpen: false,
        isSearchOpen: true,
      }),
    ).toBe(true);
  });

  it("handles Cmd+Shift+L as auto layout", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const onAutoLayout = vi.fn();
    const event = modEvent("l", { shiftKey: true });
    const handled = handleAutoLayoutShortcut(
      event,
      {
        isCompareMode: false,
        isPlaying: false,
        isRecording: false,
        isFlowPanelOpen: false,
      },
      onAutoLayout,
    );
    expect(handled).toBe(true);
    expect(onAutoLayout).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("matches auto layout when Option remapped key but code is KeyL", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const onAutoLayout = vi.fn();
    const event = new KeyboardEvent("keydown", {
      key: "¬",
      code: "KeyL",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    const handled = handleAutoLayoutShortcut(
      event,
      {
        isCompareMode: false,
        isPlaying: false,
        isRecording: false,
        isFlowPanelOpen: false,
      },
      onAutoLayout,
    );
    expect(handled).toBe(true);
    expect(onAutoLayout).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("ignores plain Cmd+L and Cmd+Alt+L for auto layout", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const onAutoLayout = vi.fn();
    expect(
      handleAutoLayoutShortcut(
        modEvent("l"),
        {
          isCompareMode: false,
          isPlaying: false,
          isRecording: false,
          isFlowPanelOpen: false,
        },
        onAutoLayout,
      ),
    ).toBe(false);
    expect(
      handleAutoLayoutShortcut(
        modEvent("l", { altKey: true }),
        {
          isCompareMode: false,
          isPlaying: false,
          isRecording: false,
          isFlowPanelOpen: false,
        },
        onAutoLayout,
      ),
    ).toBe(false);
    expect(onAutoLayout).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("handles Cmd+S save when the canvas is editable", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
    });
    const forceSave = vi.fn();
    const event = modEvent("s");
    const handled = handleSaveShortcut(
      event,
      {
        isCompareMode: false,
        isPlaying: false,
        isRecording: false,
        isFlowPanelOpen: false,
      },
      forceSave,
    );
    expect(handled).toBe(true);
    expect(forceSave).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
