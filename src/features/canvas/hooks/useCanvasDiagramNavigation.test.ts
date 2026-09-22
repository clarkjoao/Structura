import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/features/diagram";
import * as recentDiagramsModule from "../navigation/useRecentDiagrams";
import { useCanvasDiagramNavigation } from "./useCanvasDiagramNavigation";

/**
 * Spy on the live export instead of `vi.mock`: the test setup imports the
 * element bootstrap, which instantiates this module before a factory mock can
 * replace it, so the hook would keep calling the real recents store.
 */
const recordOpened = vi.fn();

function createDiagram(id: string): Diagram {
  return { id } as unknown as Diagram;
}

describe("useCanvasDiagramNavigation", () => {
  beforeEach(() => {
    recordOpened.mockClear();
    vi.spyOn(recentDiagramsModule, "useRecentDiagrams").mockReturnValue({
      recordOpened,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A store mutation (moving a node, say) hands the canvas a brand-new diagram
  // object with the same id. Keying the "record as opened" effect on the object
  // instead of the id made every such mutation re-record the diagram, and each
  // record writes localStorage and re-renders — which produced another object,
  // and so on. Above ~600 nodes one cycle outlasts the debounce and the loop
  // never settles: ~23s of long tasks after a single drag, sometimes losing the
  // drag entirely. The effect must fire on identity of the id, not of the object.
  it("records the diagram once when the store emits a new object with the same id", () => {
    const { rerender } = renderHook(
      ({ diagram }: { diagram: Diagram }) =>
        useCanvasDiagramNavigation({
          diagram,
          allDiagrams: { d1: createDiagram("d1") },
          diagramNavLocked: false,
          clearCanvasSelection: vi.fn(),
          actions: { openDiagram: vi.fn() },
          navigate: vi.fn(),
          setShowVersions: vi.fn(),
        }),
      { initialProps: { diagram: createDiagram("d1") } },
    );

    expect(recordOpened).toHaveBeenCalledTimes(1);

    rerender({ diagram: createDiagram("d1") });
    rerender({ diagram: createDiagram("d1") });

    expect(recordOpened).toHaveBeenCalledTimes(1);
    expect(recordOpened).toHaveBeenCalledWith("d1");
  });

  it("records again when the diagram id actually changes", () => {
    const { rerender } = renderHook(
      ({ diagram }: { diagram: Diagram }) =>
        useCanvasDiagramNavigation({
          diagram,
          allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
          diagramNavLocked: false,
          clearCanvasSelection: vi.fn(),
          actions: { openDiagram: vi.fn() },
          navigate: vi.fn(),
          setShowVersions: vi.fn(),
        }),
      { initialProps: { diagram: createDiagram("d1") } },
    );

    expect(recordOpened).toHaveBeenCalledTimes(1);

    rerender({ diagram: createDiagram("d2") });

    expect(recordOpened).toHaveBeenCalledTimes(2);
    expect(recordOpened).toHaveBeenLastCalledWith("d2");
  });

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
        setShowVersions: vi.fn(),
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
        setShowVersions: vi.fn(),
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
        setShowVersions: vi.fn(),
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
