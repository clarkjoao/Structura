/**
 * Phase 4 — pointer funnel tests.
 *
 * Covers selection writes through the Zustand store. DOM listeners are
 * exercised here with synthetic mousedown on a `.react-flow__node` fixture.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePointerFunnel, isMultiSelectModifier, type GestureTarget } from "./pointerFunnel";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { dragSelectionRef } from "../hooks/useLocalNodes";

function readSelection() {
  const s = useCanvasSelectionStore.getState();
  return {
    selectedNodeId: s.selectedNodeId,
    selectedNodeIds: [...s.selectedNodeIds].sort(),
  };
}

function mountNodeFixture(nodeId: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "react-flow__node";
  el.setAttribute("data-id", nodeId);
  document.body.appendChild(el);
  return el;
}

function dispatchNodeMouseDown(
  el: HTMLElement,
  modifiers: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {},
) {
  el.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 10,
      clientY: 10,
      ...modifiers,
    }),
  );
}

describe("selection/pointerFunnel", () => {
  let fixture: HTMLDivElement | null = null;

  beforeEach(() => {
    useCanvasSelectionStore.getState().clearSelection();
  });

  afterEach(() => {
    fixture?.remove();
    fixture = null;
  });

  it("exposes a constant threshold matching dragThreshold.DRAG_THRESHOLD_PX", () => {
    const { result } = renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
    expect(result.current.threshold).toBe(4);
  });

  it("isMultiSelectModifier matches Shift, Meta, and Control", () => {
    expect(isMultiSelectModifier({ shiftKey: true, metaKey: false, ctrlKey: false })).toBe(true);
    expect(isMultiSelectModifier({ shiftKey: false, metaKey: true, ctrlKey: false })).toBe(true);
    expect(isMultiSelectModifier({ shiftKey: false, metaKey: false, ctrlKey: true })).toBe(true);
    expect(isMultiSelectModifier({ shiftKey: false, metaKey: false, ctrlKey: false })).toBe(false);
  });

  it("Shift pointerdown on an unselected node adds to the existing selection", () => {
    renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
    fixture = mountNodeFixture("b");
    dispatchNodeMouseDown(fixture, { shiftKey: true });
    expect(readSelection()).toEqual({ selectedNodeId: "a", selectedNodeIds: ["a", "b"] });
  });

  it("Cmd (metaKey) pointerdown on an unselected node adds to the existing selection", () => {
    renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
    fixture = mountNodeFixture("b");
    dispatchNodeMouseDown(fixture, { metaKey: true });
    expect(readSelection()).toEqual({ selectedNodeId: "a", selectedNodeIds: ["a", "b"] });
  });

  it("Ctrl pointerdown on an unselected node adds to the existing selection", () => {
    renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
    fixture = mountNodeFixture("b");
    dispatchNodeMouseDown(fixture, { ctrlKey: true });
    expect(readSelection()).toEqual({ selectedNodeId: "a", selectedNodeIds: ["a", "b"] });
  });

  it("plain pointerdown on an unselected node replaces the selection", () => {
    renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
    fixture = mountNodeFixture("b");
    dispatchNodeMouseDown(fixture);
    expect(readSelection()).toEqual({ selectedNodeId: "b", selectedNodeIds: ["b"] });
  });

  it("cancelInFlightGesture returns false when there is nothing to cancel", () => {
    const { result } = renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
    expect(result.current.cancelInFlightGesture()).toBe(false);
  });

  it("shouldBodyClickSelect returns false (decision #1: body never selects)", async () => {
    const { shouldBodyClickSelect } = await import("./pointerFunnel");
    expect(shouldBodyClickSelect()).toBe(false);
  });

  it("GestureTarget shape stays additive — kinds are exhaustive", () => {
    const targets: GestureTarget[] = [
      { kind: "panel-header", nodeId: "x" },
      { kind: "panel-border", nodeId: "x" },
      { kind: "panel-body", nodeId: "x" },
      { kind: "node", nodeId: "x" },
      { kind: "pane", atScreen: { x: 0, y: 0 } },
    ];
    expect(targets.length).toBe(5);
  });

  describe("a click inside a panel body (decision #1)", () => {
    function at(el: HTMLElement, type: string) {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 40,
          clientY: 40,
        }),
      );
    }

    it("clears the selection even after PanelNode forwards the press to the pane", () => {
      let cleared = 0;
      renderHook(() =>
        usePointerFunnel({ openContextMenu: () => {}, onBackgroundClick: () => (cleared += 1) }),
      );
      const pane = document.createElement("div");
      pane.className = "react-flow__pane";
      const panel = mountNodeFixture("panel");
      const body = document.createElement("div");
      body.className = "panel-body";
      panel.appendChild(body);
      document.body.appendChild(pane);
      try {
        at(body, "pointerdown");
        // PanelNode's copy, so React Flow arms its marquee (same coordinates).
        at(pane, "pointerdown");
        at(body, "mousedown");
        at(body, "pointerup");
        at(body, "mouseup");
        expect(cleared).toBe(1);
      } finally {
        panel.remove();
        pane.remove();
      }
    });
  });

  describe("a real browser's press: pointerdown, then its compatibility mousedown", () => {
    function press(el: HTMLElement, type: "pointerdown" | "mousedown" | "pointerup" | "mouseup") {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 10,
          clientY: 10,
          shiftKey: true,
        }),
      );
    }

    it("toggles a Shift-clicked node once, not in and straight back out", () => {
      renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
      useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
      fixture = mountNodeFixture("b");
      press(fixture, "pointerdown");
      press(fixture, "mousedown");
      press(fixture, "pointerup");
      press(fixture, "mouseup");
      expect(readSelection().selectedNodeIds).toEqual(["a", "b"]);
    });

    it("still handles the next mouse-only press after a press whose mousedown never came", () => {
      renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
      useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
      fixture = mountNodeFixture("b");
      press(fixture, "pointerdown");
      press(fixture, "pointerup");
      // Cypress-style press: mousedown only, same spot.
      press(fixture, "mousedown");
      expect(readSelection().selectedNodeIds).toEqual(["a"]);
    });

    it("marks the press as the funnel's, until the next press", () => {
      renderHook(() => usePointerFunnel({ openContextMenu: () => {} }));
      useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
      fixture = mountNodeFixture("b");
      press(fixture, "pointerdown");
      expect(dragSelectionRef.selectionWrittenByFunnel).toBe(true);

      // Holding the modifier is not a new gesture; any other key is.
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      expect(dragSelectionRef.selectionWrittenByFunnel).toBe(true);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(dragSelectionRef.selectionWrittenByFunnel).toBe(false);
    });
  });
});
