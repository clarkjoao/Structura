import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Component, Diagram } from "@/features/diagram";
import { useCanvasLockStore } from "./canvasLock.store";
import { useCanvasKeyboard } from "./useCanvasKeyboard";

// Ctrl/Cmd+V reads the system clipboard after its first await; nothing to read in jsdom.
vi.mock("@/lib/clipboard", () => ({
  readDrawioFromClipboard: vi.fn(async () => null),
  readRasterImageBlobFromClipboard: vi.fn(async () => null),
  readStructuraClipboard: vi.fn(async () => null),
  readSvgFromClipboard: vi.fn(async () => null),
  writeDrawioToClipboard: vi.fn(async () => undefined),
  extractSvgMarkup: vi.fn(() => null),
}));

type Overrides = Partial<Parameters<typeof useCanvasKeyboard>[0]>;

function setup(overrides: Overrides = {}) {
  const partialInstance: Pick<
    ReactFlowInstance,
    "getNodes" | "getEdges" | "setNodes" | "getViewport" | "screenToFlowPosition"
  > = {
    getNodes: () => [{ id: "n1", position: { x: 0, y: 0 }, data: {}, selected: true }],
    getEdges: () => [],
    setNodes: vi.fn(),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: (p) => p,
  };
  const spies = {
    undo: vi.fn(),
    redo: vi.fn(),
    removeElements: vi.fn(),
    forceSaveToFolder: vi.fn(),
    onAutoLayout: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenCatalog: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onToggleDiagramSidebar: vi.fn(),
    onOpenQuickInsert: vi.fn(),
    onInsertTool: vi.fn((key: string) => key === "n"),
    addComponent: vi.fn(() => ({ id: "c1" }) as Component),
    setSelectedNodeIds: vi.fn(),
    clearClipboard: vi.fn(),
    kindHandler: vi.fn((event: KeyboardEvent) => event.key === "Tab"),
  };
  const params: Parameters<typeof useCanvasKeyboard>[0] = {
    diagram: { id: "d", snapshot: { components: {}, connections: {} }, nodeLayouts: {} } as Diagram,
    setCompareVersion: vi.fn(),
    services: {},
    selectedNodeId: "n1",
    selectedEdgeId: null,
    reactFlowInstance: partialInstance as ReactFlowInstance,
    reactFlowWrapperRef: { current: null },
    setSelectedNodeId: vi.fn(),
    setSelectedNodeIds: spies.setSelectedNodeIds,
    setSelectedEdgeId: vi.fn(),
    setContextMenu: vi.fn(),
    undo: spies.undo,
    redo: spies.redo,
    removeElements: spies.removeElements,
    groupNodes: vi.fn(() => null),
    ungroupNodes: vi.fn(),
    setParent: vi.fn(),
    updateNodeLayout: vi.fn(),
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(() => []),
    importDrawioResult: vi.fn(() => []),
    hydrateClipboard: vi.fn(),
    clearClipboard: spies.clearClipboard,
    addComponent: spies.addComponent,
    isPanelOpen: false,
    isFlowPanelOpen: false,
    onOpenSearch: spies.onOpenSearch,
    onOpenCatalog: spies.onOpenCatalog,
    onOpenCommandPalette: spies.onOpenCommandPalette,
    onToggleDiagramSidebar: spies.onToggleDiagramSidebar,
    onOpenQuickInsert: spies.onOpenQuickInsert,
    onInsertTool: spies.onInsertTool,
    onAutoLayout: spies.onAutoLayout,
    forceSaveToFolder: spies.forceSaveToFolder,
    resetEdgeControlPoints: vi.fn(),
    updateComponent: vi.fn(),
    kindHandler: spies.kindHandler,
    ...overrides,
  };
  const hook = renderHook(() => useCanvasKeyboard(params));
  return { ...hook, params, spies };
}

/** Sends a keydown from `target` (bubbles to the document capture listener) and reports if it was claimed. */
async function press(
  target: Element,
  key: string,
  init: KeyboardEventInit = {},
): Promise<{ claimed: boolean }> {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return { claimed: event.defaultPrevented };
}

/**
 * plain   : bare keys. A focused field always keeps them.
 * osText  : Mod+A/C/V/Z. Text-editing chords; a focused field keeps them.
 * modTool : every other Mod chord. NAMED EXCEPTION (helpers.ts, shouldYieldCanvasShortcutToFocusedField):
 *           they run on the canvas even from a focused field, so an open side panel cannot swallow them.
 */
type Group = "plain" | "osText" | "modTool";

interface Shortcut {
  name: string;
  key: string;
  mod?: boolean;
  shift?: boolean;
  group: Group;
  /** Spy that proves the shortcut reached its action, when one is observable. */
  spy?: (spies: ReturnType<typeof setup>["spies"]) => Mock;
}

// Enumerated from useCanvasKeyboard's handler chain, createToolShortcuts and ShortcutsModal.
const SHORTCUTS: Shortcut[] = [
  { name: "Delete", key: "Delete", group: "plain", spy: (s) => s.removeElements },
  { name: "Backspace", key: "Backspace", group: "plain", spy: (s) => s.removeElements },
  { name: "Escape", key: "Escape", group: "plain", spy: (s) => s.clearClipboard },
  { name: "kind chord Tab", key: "Tab", group: "plain", spy: (s) => s.kindHandler },
  { name: "/ quick insert", key: "/", group: "plain", spy: (s) => s.onOpenQuickInsert },
  {
    name: "Shift+E quick insert",
    key: "E",
    shift: true,
    group: "plain",
    spy: (s) => s.onOpenQuickInsert,
  },
  { name: "N toolbar insert", key: "n", group: "plain", spy: (s) => s.onInsertTool },
  {
    name: "Mod+A select all",
    key: "a",
    mod: true,
    group: "osText",
    spy: (s) => s.setSelectedNodeIds,
  },
  { name: "Mod+C copy", key: "c", mod: true, group: "osText" },
  { name: "Mod+V paste", key: "v", mod: true, group: "osText" },
  { name: "Mod+Z undo", key: "z", mod: true, group: "osText", spy: (s) => s.undo },
  {
    name: "Mod+Shift+Z redo",
    key: "z",
    mod: true,
    shift: true,
    group: "osText",
    spy: (s) => s.redo,
  },
  { name: "Mod+D duplicate", key: "d", mod: true, group: "modTool" },
  { name: "Mod+G group", key: "g", mod: true, group: "modTool" },
  { name: "Mod+Shift+G ungroup", key: "g", mod: true, shift: true, group: "modTool" },
  { name: "Mod+Shift+K lock", key: "k", mod: true, shift: true, group: "modTool" },
  { name: "Mod+Shift+W reset waypoints", key: "w", mod: true, shift: true, group: "modTool" },
  { name: "Mod+S save", key: "s", mod: true, group: "modTool", spy: (s) => s.forceSaveToFolder },
  {
    name: "Mod+Shift+L auto layout",
    key: "l",
    mod: true,
    shift: true,
    group: "modTool",
    spy: (s) => s.onAutoLayout,
  },
  { name: "Mod+F search", key: "f", mod: true, group: "modTool", spy: (s) => s.onOpenSearch },
  { name: "Mod+/ search", key: "/", mod: true, group: "modTool", spy: (s) => s.onOpenSearch },
  { name: "Mod+K catalog", key: "k", mod: true, group: "modTool", spy: (s) => s.onOpenCatalog },
  {
    name: "Mod+P palette",
    key: "p",
    mod: true,
    group: "modTool",
    spy: (s) => s.onOpenCommandPalette,
  },
  {
    name: "Mod+B sidebar",
    key: "b",
    mod: true,
    group: "modTool",
    spy: (s) => s.onToggleDiagramSidebar,
  },
  { name: "Mod+1 new person", key: "1", mod: true, group: "modTool", spy: (s) => s.addComponent },
];

function init(shortcut: Shortcut): KeyboardEventInit {
  return { metaKey: shortcut.mod === true, shiftKey: shortcut.shift === true };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  parent: Element = document.body,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
}

/** jsdom does not implement isContentEditable; give the element the browser's answer. */
function contentEditable(node: HTMLElement): HTMLElement {
  Object.defineProperty(node, "isContentEditable", { value: true });
  return node;
}

type Surface = "canvas" | "editable" | "no-gate" | "dialog";

interface Target {
  name: string;
  surface: Surface;
  build: () => Element;
}

const TARGETS: Target[] = [
  { name: "canvas pane", surface: "canvas", build: () => el("div", { class: "react-flow__pane" }) },
  { name: "input", surface: "editable", build: () => el("input") },
  { name: "textarea", surface: "editable", build: () => el("textarea") },
  { name: "select", surface: "editable", build: () => el("select") },
  { name: "contenteditable", surface: "editable", build: () => contentEditable(el("div")) },
  {
    name: "child of a contenteditable",
    surface: "editable",
    build: () => el("span", {}, contentEditable(el("div"))),
  },
  { name: "role=textbox", surface: "editable", build: () => el("div", { role: "textbox" }) },
  {
    // c5c03f6d: Monaco's native edit context is a plain div inside .monaco-editor.
    name: "Monaco editor (native edit context)",
    surface: "editable",
    build: () => el("div", { class: "native-edit-context" }, el("div", { class: "monaco-editor" })),
  },
  {
    // c5c03f6d: the plugin code editor's wrapper carries `nokey`; keys typed in it are not canvas shortcuts.
    name: "plugin code editor container (.nokey > .monaco-editor)",
    surface: "editable",
    build: () => {
      const wrapper = el("div", { class: "nokey" });
      const monaco = el("div", { class: "monaco-editor" }, wrapper);
      return el("div", { class: "native-edit-context" }, monaco);
    },
  },
  {
    // NAMED EXCEPTION: only editable fields yield. A focused control in a plugin pane is not a field.
    name: "plugin pane control (button)",
    surface: "no-gate",
    build: () => el("button", {}, el("div", { "data-plugin-slot": "document-pane" })),
  },
  {
    // NAMED EXCEPTION: no menu gate exists; a focused menu item is not a field.
    name: "open menu item",
    surface: "no-gate",
    build: () => el("div", { role: "menuitem" }, el("div", { role: "menu", "data-state": "open" })),
  },
  {
    // NAMED EXCEPTION: an open dialog owns Escape only (isDialogLayerOpen).
    name: "open dialog",
    surface: "dialog",
    build: () => el("button", {}, el("div", { role: "dialog", "data-state": "open" })),
  },
];

beforeEach(() => {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    platform: "MacIntel",
  });
  useCanvasLockStore.setState({ locked: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function expectsToFire(shortcut: Shortcut, target: Target): boolean {
  switch (target.surface) {
    case "canvas":
    case "no-gate":
      return true;
    case "dialog":
      return shortcut.key !== "Escape";
    case "editable":
      return shortcut.group === "modTool";
  }
}

describe("useCanvasKeyboard shortcut scope", () => {
  describe.each(TARGETS)("from $name", (target) => {
    it.each(SHORTCUTS)("$name", async (shortcut) => {
      const { spies } = setup();
      const node = target.build();
      const { claimed } = await press(node, shortcut.key, init(shortcut));
      const fires = expectsToFire(shortcut, target);
      expect(claimed).toBe(fires);
      const spy = shortcut.spy?.(spies);
      if (spy) {
        if (fires) expect(spy).toHaveBeenCalled();
        else expect(spy).not.toHaveBeenCalled();
      }
    });
  });

  it("an overlay layer (catalog / quick insert) takes every canvas key, even save", async () => {
    const { spies } = setup();
    el("div", { "data-canvas-overlay": "open" });
    const pane = el("div", { class: "react-flow__pane" });
    for (const shortcut of SHORTCUTS) {
      const { claimed } = await press(pane, shortcut.key, init(shortcut));
      // Mod+Shift+L is covered by the it.fails below: it does not honour the overlay.
      if (shortcut.name !== "Mod+Shift+L auto layout") expect(claimed, shortcut.name).toBe(false);
    }
    expect(spies.forceSaveToFolder).not.toHaveBeenCalled();
    expect(spies.removeElements).not.toHaveBeenCalled();
  });

  // BUG on current code: handleAutoLayoutShortcut checks only the mode locks, not
  // isCanvasOverlayOpen, so Cmd+Shift+L re-arranges the diagram behind an open catalog /
  // quick insert while Cmd+S and every edit chord stand down. Remove `.fails` when fixed.
  it.fails("an overlay layer also blocks auto layout", async () => {
    const { spies } = setup();
    el("div", { "data-canvas-overlay": "open" });
    await press(el("div", { class: "react-flow__pane" }), "l", { metaKey: true, shiftKey: true });
    expect(spies.onAutoLayout).not.toHaveBeenCalled();
  });

  it("with no diagram, only save still runs", async () => {
    const { spies } = setup({ diagram: null });
    const pane = el("div", { class: "react-flow__pane" });
    await press(pane, "Delete");
    await press(pane, "z", { metaKey: true });
    await press(pane, "s", { metaKey: true });
    expect(spies.removeElements).not.toHaveBeenCalled();
    expect(spies.undo).not.toHaveBeenCalled();
    expect(spies.forceSaveToFolder).toHaveBeenCalledOnce();
  });
});

describe("useCanvasKeyboard mode locks", () => {
  // d364c300: playback / flow reading owns the keyboard; the canvas must not also edit or navigate.
  // c1940fde: a kind's own Delete/Tab are canvas edit chords, so they stand down in the same modes.
  const MODES: Array<[string, Overrides]> = [
    ["playing a flow", { isPlaying: true }],
    ["flow panel open", { isFlowPanelOpen: true }],
    ["recording a flow", { isRecording: true }],
    ["comparing versions", { isCompareMode: true }],
  ];

  it.each(MODES)("%s: no edit or tool chord runs", async (_name, overrides) => {
    const { spies } = setup(overrides);
    const pane = el("div", { class: "react-flow__pane" });
    for (const shortcut of SHORTCUTS.filter((s) => s.key !== "Escape")) {
      await press(pane, shortcut.key, init(shortcut));
    }
    expect(spies.removeElements).not.toHaveBeenCalled();
    expect(spies.undo).not.toHaveBeenCalled();
    expect(spies.redo).not.toHaveBeenCalled();
    expect(spies.kindHandler).not.toHaveBeenCalled();
    expect(spies.onInsertTool).not.toHaveBeenCalled();
    expect(spies.onOpenQuickInsert).not.toHaveBeenCalled();
    expect(spies.onOpenCatalog).not.toHaveBeenCalled();
    expect(spies.onAutoLayout).not.toHaveBeenCalled();
    expect(spies.forceSaveToFolder).not.toHaveBeenCalled();
  });

  it("the Controls padlock stops edits and tools but still saves", async () => {
    useCanvasLockStore.setState({ locked: true });
    const { spies } = setup();
    const pane = el("div", { class: "react-flow__pane" });
    for (const shortcut of SHORTCUTS) await press(pane, shortcut.key, init(shortcut));
    expect(spies.removeElements).not.toHaveBeenCalled();
    expect(spies.undo).not.toHaveBeenCalled();
    expect(spies.onOpenCatalog).not.toHaveBeenCalled();
    expect(spies.onAutoLayout).not.toHaveBeenCalled();
    expect(spies.forceSaveToFolder).toHaveBeenCalledOnce();
  });

  it("compare mode claims Delete so it cannot mutate the live diagram", async () => {
    const { spies } = setup({ isCompareMode: true });
    const pane = el("div", { class: "react-flow__pane" });
    const { claimed } = await press(pane, "Delete");
    expect(claimed).toBe(true);
    expect(spies.removeElements).not.toHaveBeenCalled();
  });
});

describe("useCanvasKeyboard chain order", () => {
  // c1940fde: guided keyboard chaining / multi-step delete. The kind's chord runs before the
  // canvas's own Delete, and a chord the kind claims never reaches the generic handler.
  it("a kind that claims Delete keeps it from the generic delete", async () => {
    const kindHandler = vi.fn((event: KeyboardEvent) => event.key === "Delete");
    const { spies } = setup({ kindHandler });
    const pane = el("div", { class: "react-flow__pane" });
    const { claimed } = await press(pane, "Delete");
    expect(claimed).toBe(true);
    expect(kindHandler).toHaveBeenCalledOnce();
    expect(spies.removeElements).not.toHaveBeenCalled();
  });

  it("a kind that does not claim Delete lets the canvas delete", async () => {
    const kindHandler = vi.fn(() => false);
    const { spies } = setup({ kindHandler });
    const pane = el("div", { class: "react-flow__pane" });
    await press(pane, "Delete");
    expect(kindHandler).toHaveBeenCalledOnce();
    expect(spies.removeElements).toHaveBeenCalledOnce();
  });

  // c1940fde: "type the name, Tab, type the next". The name field's chords run before the focus
  // yield, but only from the field the gesture opened, and never while the canvas is locked.
  it("the label-field handler runs from an input, other fields keep their keys", async () => {
    const kindLabelFieldHandler = vi.fn((event: KeyboardEvent) => event.key === "Tab");
    const { spies } = setup({ kindLabelFieldHandler });
    const field = el("input", { "data-panel-title": "" });
    const { claimed } = await press(field, "Tab");
    expect(claimed).toBe(false);
    expect(kindLabelFieldHandler).toHaveBeenCalledOnce();
    await press(field, "Delete");
    expect(spies.removeElements).not.toHaveBeenCalled();
    expect(spies.kindHandler).not.toHaveBeenCalled();
  });

  it("the label-field handler stands down while the canvas is locked", async () => {
    useCanvasLockStore.setState({ locked: true });
    const kindLabelFieldHandler = vi.fn(() => true);
    setup({ kindLabelFieldHandler });
    await press(el("input"), "Tab");
    expect(kindLabelFieldHandler).not.toHaveBeenCalled();
  });
});

describe("useCanvasKeyboard cleanup", () => {
  it("stops listening once unmounted", async () => {
    const { spies, unmount } = setup();
    unmount();
    const { claimed } = await press(el("div"), "s", { metaKey: true });
    expect(claimed).toBe(false);
    expect(spies.forceSaveToFolder).not.toHaveBeenCalled();
  });
});
