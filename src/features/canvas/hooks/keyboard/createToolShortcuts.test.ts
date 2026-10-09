import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactFlowInstance } from "@xyflow/react";
import { createToolShortcuts } from "./createToolShortcuts";
import { isCanvasOverlayOpen } from "./canvasKeydownGates";

function setup() {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    platform: "MacIntel",
  });
  const callbacks = {
    onOpenCatalog: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onOpenQuickInsert: vi.fn(),
    onInsertTool: vi.fn((key: string) => ["n", "p", "l"].includes(key)),
  };
  const handler = createToolShortcuts({
    ...callbacks,
    reactFlowInstance: {
      screenToFlowPosition: (p: { x: number; y: number }) => p,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    } as unknown as ReactFlowInstance,
    isPanelOpen: false,
    c4ShortcutMap: {},
    lastPointerScreenRef: { current: { x: 10, y: 20 } },
    addComponent: vi.fn(),
    setSelectedNodeId: vi.fn(),
    setSelectedNodeIds: vi.fn(),
    setSelectedEdgeId: vi.fn(),
  });
  return { handler, callbacks };
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });

describe("canvas tool shortcuts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("⌘K opens the element catalog and ⌘P the diagram palette", () => {
    const { handler, callbacks } = setup();
    expect(handler(key("k", { metaKey: true }))).toBe(true);
    expect(callbacks.onOpenCatalog).toHaveBeenCalledOnce();
    expect(callbacks.onOpenCommandPalette).not.toHaveBeenCalled();
    const print = key("p", { metaKey: true });
    expect(handler(print)).toBe(true);
    expect(print.defaultPrevented).toBe(true);
    expect(callbacks.onOpenCommandPalette).toHaveBeenCalledOnce();
  });

  it("/ opens quick insert at the pointer", () => {
    const { handler, callbacks } = setup();
    expect(handler(key("/"))).toBe(true);
    expect(callbacks.onOpenQuickInsert).toHaveBeenCalledWith({
      screenPos: { x: 10, y: 20 },
      flowPos: { x: 10, y: 20 },
    });
  });

  it("plain N, P and L insert; another letter is left alone", () => {
    const { handler, callbacks } = setup();
    for (const letter of ["n", "p", "l"]) expect(handler(key(letter))).toBe(true);
    const other = key("x");
    expect(handler(other)).toBe(false);
    expect(other.defaultPrevented).toBe(false);
    expect(callbacks.onInsertTool).toHaveBeenCalledTimes(4);
    // With a modifier it is not a tool key.
    expect(handler(key("n", { altKey: true }))).toBe(false);
  });

  it("an open catalog or quick insert holds the keyboard", () => {
    const flags = {
      isCompareMode: false,
      isPlaying: false,
      isRecording: false,
      isFlowPanelOpen: false,
    };
    expect(isCanvasOverlayOpen(flags)).toBe(false);
    document.body.innerHTML = '<div data-canvas-overlay="open"></div>';
    expect(isCanvasOverlayOpen(flags)).toBe(true);
    document.body.innerHTML = '<div data-canvas-overlay="closed"></div>';
    expect(isCanvasOverlayOpen(flags)).toBe(false);
  });
});
