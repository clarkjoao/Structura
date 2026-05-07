import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/features/diagram";
import { useCanvasDrillHandlers } from "./useCanvasDrillHandlers";

const { getCachedCanvasSnapshotMock } = vi.hoisted(() => ({
  getCachedCanvasSnapshotMock: vi.fn(),
}));

vi.mock("@/features/diagram", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/features/diagram")>();
  return {
    ...mod,
    getCachedCanvasSnapshot: getCachedCanvasSnapshotMock,
  };
});

function createDiagram(id: string): Diagram {
  return { id } as unknown as Diagram;
}

describe("useCanvasDrillHandlers", () => {
  it("blocks drilldown when diagramNavLocked=true", () => {
    getCachedCanvasSnapshotMock.mockReturnValue({
      components: { nodeA: { id: "nodeA", linkedDiagramId: "d2" } },
      nodeLayouts: {},
    });

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
    });

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
    expect(navigate).toHaveBeenCalledWith("/diagram/d2");
  });

  it("no-ops when component has no linkedDiagramId", () => {
    getCachedCanvasSnapshotMock.mockReturnValue({
      components: { nodeA: { id: "nodeA" } },
      nodeLayouts: {},
    });

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
