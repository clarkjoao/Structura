import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { useDiagramStore } from "@/features/diagram";

/**
 * "Organize children (LR)" keeps ELK bend points, same as whole-diagram
 * Auto Layout (Cmd/Ctrl+Shift+L).
 *
 * Mid-X orthogonal Zs after a path reset crossed and ran through nodes; the
 * call site therefore omits `resetPaths` so `applyLayoutResultEdges` writes
 * interior waypoints. Scope (`edgeIds`) is still this panel's edges only.
 *
 * `applyLayoutResultEdges` is mocked so this asserts what the call site asks
 * for. Waypoint writing itself is covered by `applyLayoutResult.test.ts`.
 */

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const applyLayoutResultEdges = vi.fn();
vi.mock("../layout/applyLayoutResult", () => ({
  applyLayoutResultEdges: (...args: unknown[]) => applyLayoutResultEdges(...args),
}));

import { usePanelChildLayout } from "./usePanelChildLayout";

function wrapper({ children }: { children: ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

/** A panel with two children an edge apart — enough for the layout to run. */
function seedDiagram() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("panel-scope", "container");
  store.openDiagram(diagram.id);

  const panel = useDiagramStore.getState().addComponent("panel", "Panel", null);
  const a = useDiagramStore.getState().addComponent("system", "A", panel.id);
  const b = useDiagramStore.getState().addComponent("system", "B", panel.id);
  useDiagramStore.getState().addConnection(a.id, b.id, "uses");

  return panel.id;
}

describe("panel child layout", () => {
  beforeEach(() => {
    applyLayoutResultEdges.mockClear();
  });

  it("keeps ELK waypoints (does not ask to reset paths)", async () => {
    const panelId = seedDiagram();
    const { result } = renderHook(() => usePanelChildLayout(), { wrapper });

    await act(async () => {
      await result.current.runPanelChildLayout(panelId);
    });

    expect(applyLayoutResultEdges).toHaveBeenCalled();
    const options = applyLayoutResultEdges.mock.calls[0]![3] as { resetPaths?: boolean };
    expect(options.resetPaths).toBeUndefined();
  });

  /**
   * The scope is the other half of what this call site owns: it lays out one
   * panel, so it must not rewrite paths on edges elsewhere in the diagram.
   */
  it("still limits itself to the edges it laid out", async () => {
    const panelId = seedDiagram();
    const { result } = renderHook(() => usePanelChildLayout(), { wrapper });

    await act(async () => {
      await result.current.runPanelChildLayout(panelId);
    });

    const options = applyLayoutResultEdges.mock.calls[0]![3] as { edgeIds?: ReadonlySet<string> };
    expect(options.edgeIds).toBeInstanceOf(Set);
  });
});
