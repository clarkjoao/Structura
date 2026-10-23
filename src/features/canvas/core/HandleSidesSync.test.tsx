import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";

const updateNodeInternals = vi.fn();
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useUpdateNodeInternals: () => updateNodeInternals,
    useStoreApi: () => ({ getState: () => ({ nodes: [{ id: "a" }, { id: "b" }] }) }),
  };
});

const { HandleSidesSync } = await import("./HandleSidesSync");

/**
 * Switching the direction moves every handle without resizing a node, and
 * React Flow only re-measures handles on a resize: without this, edges kept
 * leaving from the side the handles used to be on.
 */
describe("HandleSidesSync", () => {
  afterEach(() => {
    updateNodeInternals.mockClear();
    vi.useRealTimers();
  });

  it("re-measures every node's handles when the direction changes, not before", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const view = render(
      <ReactFlowProvider>
        <HandleSidesSync direction="LR" />
      </ReactFlowProvider>,
    );
    vi.runAllTimers();
    expect(updateNodeInternals).not.toHaveBeenCalled();

    view.rerender(
      <ReactFlowProvider>
        <HandleSidesSync direction="TB" />
      </ReactFlowProvider>,
    );
    vi.runAllTimers();
    expect(updateNodeInternals).toHaveBeenCalledWith(["a", "b"]);
  });
});
