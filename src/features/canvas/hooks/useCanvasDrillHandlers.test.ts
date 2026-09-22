import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as diagramModule from "@/features/diagram";
import type { Diagram } from "@/features/diagram";
import { useCanvasDrillHandlers } from "./useCanvasDrillHandlers";

/**
 * Spy on the live export instead of `vi.mock`: the test setup imports the
 * element bootstrap, which instantiates this barrel before a factory mock can
 * replace it, so the hook would keep calling the real snapshot resolver.
 */
let getCachedCanvasSnapshotMock: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getCachedCanvasSnapshotMock = vi.spyOn(diagramModule, "getCachedCanvasSnapshot");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createDiagram(id: string): Diagram {
  return { id } as unknown as Diagram;
}

describe("useCanvasDrillHandlers", () => {
  it("blocks drilldown when diagramNavLocked=true", () => {
    getCachedCanvasSnapshotMock.mockReturnValue({
      components: { nodeA: { id: "nodeA", linkedDiagramId: "d2" } },
      nodeLayouts: {},
    } as never);

    const clearCanvasSelection = vi.fn();
    const openDiagram = vi.fn();
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDrillHandlers({
        diagram: createDiagram("d1"),
        allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
        diagramNavLocked: true,
        clearCanvasSelection,
        updateComponent: vi.fn(),
        openDiagram,
        navigate,
      }),
    );

    act(() => {
      result.current.handleDrillDown("nodeA");
    });

    expect(clearCanvasSelection).not.toHaveBeenCalled();
    expect(openDiagram).not.toHaveBeenCalled();
  });

  it("calls clearCanvasSelection before openDiagram when diagramNavLocked=false", () => {
    getCachedCanvasSnapshotMock.mockReturnValue({
      components: { nodeA: { id: "nodeA", linkedDiagramId: "d2" } },
      nodeLayouts: {},
    } as never);

    const calls: string[] = [];
    const clearCanvasSelection = vi.fn(() => calls.push("clearCanvasSelection"));
    const openDiagram = vi.fn(() => calls.push("openDiagram"));
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDrillHandlers({
        diagram: createDiagram("d1"),
        allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
        diagramNavLocked: false,
        clearCanvasSelection,
        updateComponent: vi.fn(),
        openDiagram,
        navigate,
      }),
    );

    act(() => {
      result.current.handleDrillDown("nodeA");
    });

    expect(calls).toEqual(["clearCanvasSelection", "openDiagram"]);
    expect(navigate).toHaveBeenCalledWith("/model/d2");
  });

  it("no-ops when component has no linkedDiagramId", () => {
    getCachedCanvasSnapshotMock.mockReturnValue({
      components: { nodeA: { id: "nodeA" } },
      nodeLayouts: {},
    } as never);

    const clearCanvasSelection = vi.fn();
    const openDiagram = vi.fn();
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDrillHandlers({
        diagram: createDiagram("d1"),
        allDiagrams: { d1: createDiagram("d1"), d2: createDiagram("d2") },
        diagramNavLocked: false,
        clearCanvasSelection,
        updateComponent: vi.fn(),
        openDiagram,
        navigate,
      }),
    );

    act(() => {
      result.current.handleDrillDown("nodeA");
    });

    expect(clearCanvasSelection).toHaveBeenCalledTimes(1);
    expect(openDiagram).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
