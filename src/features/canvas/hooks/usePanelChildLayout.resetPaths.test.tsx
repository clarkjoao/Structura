import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { useDiagramStore } from "@/features/diagram";

/**
 * "Organize children (LR)" leaves the connection paths reset, same as
 * "Auto Layout (LR)".
 *
 * The two are the same gesture on different scopes, and they hit the same
 * mismatch: ELK routes border to border while the canvas draws handle to
 * handle, so the bend points ELK produces describe a path for endpoints the
 * edge never uses. Half a rule — one command clearing the paths and its sibling
 * writing them back — is worse than either answer on its own.
 *
 * `applyLayoutResultEdges` is mocked so this asserts what the call site asks
 * for. What the helper then does with `resetPaths` is held by
 * `layout/applyLayoutResult.resetPaths.test.ts`; proving it twice here would
 * test the helper again and this call site not at all.
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

  it("asks for the connection paths to be reset", async () => {
    const panelId = seedDiagram();
    const { result } = renderHook(() => usePanelChildLayout(), { wrapper });

    await act(async () => {
      await result.current.runPanelChildLayout(panelId);
    });

    expect(applyLayoutResultEdges).toHaveBeenCalled();
    const options = applyLayoutResultEdges.mock.calls[0]![3] as { resetPaths?: boolean };
    expect(options.resetPaths).toBe(true);
  });

  /**
   * The scope is the other half of what this call site owns: it lays out one
   * panel, so it must not clear paths on edges elsewhere in the diagram.
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
