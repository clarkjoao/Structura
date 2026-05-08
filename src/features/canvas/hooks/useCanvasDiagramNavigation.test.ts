import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/features/diagram";
import { useCanvasDiagramNavigation } from "./useCanvasDiagramNavigation";

vi.mock("../navigation/useRecentDiagrams", () => ({
  useRecentDiagrams: () => ({
    recordOpened: vi.fn(),
  }),
}));

function createDiagram(id: string): Diagram {
  return { id } as unknown as Diagram;
}

describe("useCanvasDiagramNavigation", () => {
  it("calls clearCanvasSelection before openDiagram on diagram switch", () => {
    const calls: string[] = [];
    const clearCanvasSelection = vi.fn(() => calls.push("clearCanvasSelection"));
    const openDiagram = vi.fn(() => calls.push("openDiagram"));
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDiagramNavigation({
        diagram: createDiagram("d1"),
        allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
        diagramNavLocked: false,
        clearCanvasSelection,
        actions: { openDiagram },
        navigate,
        setShowScenes: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleSelectDiagram("d2");
    });

    expect(calls).toEqual(["clearCanvasSelection", "openDiagram"]);
    expect(navigate).toHaveBeenCalledWith("/model/d2");
  });

  it("does not call clearCanvasSelection when navigating to the current diagram", () => {
    const clearCanvasSelection = vi.fn();
    const openDiagram = vi.fn();
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDiagramNavigation({
        diagram: createDiagram("d1"),
        allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
        diagramNavLocked: false,
        clearCanvasSelection,
        actions: { openDiagram },
        navigate,
        setShowScenes: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleSelectDiagram("d1");
    });

    expect(clearCanvasSelection).not.toHaveBeenCalled();
    expect(openDiagram).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not call clearCanvasSelection when diagramNavLocked=true", () => {
    const clearCanvasSelection = vi.fn();
    const openDiagram = vi.fn();
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDiagramNavigation({
        diagram: createDiagram("d1"),
        allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
        diagramNavLocked: true,
        clearCanvasSelection,
        actions: { openDiagram },
        navigate,
        setShowScenes: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleSelectDiagram("d2");
    });

    expect(clearCanvasSelection).not.toHaveBeenCalled();
    expect(openDiagram).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
