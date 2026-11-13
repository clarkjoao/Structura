import { act, render, renderHook } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { memo, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  createSelectionControls,
  useSelectionDisablesControls,
  useSyncSelectionControls,
} from "./selectionControls";

describe("createSelectionControls", () => {
  it("disables what is outside a selection, and nothing without one", () => {
    const controls = createSelectionControls();
    expect(controls.disables("a")).toBe(false);

    controls.update(new Set(["a"]), true);
    expect(controls.disables("a")).toBe(false);
    expect(controls.disables("b")).toBe(true);

    controls.update(new Set(), true);
    expect(controls.disables("b")).toBe(false);
  });

  it("disables nothing while a flow is played or recorded", () => {
    const controls = createSelectionControls();
    controls.update(new Set(["a"]), false);
    expect(controls.disables("b")).toBe(false);
  });

  it("tells its listeners only when the selection or the mode changed", () => {
    const controls = createSelectionControls();
    let calls = 0;
    controls.subscribe(() => (calls += 1));
    const selection = new Set(["a"]);
    controls.update(selection, true);
    controls.update(selection, true);
    controls.update(selection, false);
    expect(calls).toBe(2);
  });
});

describe("useSelectionDisablesControls", () => {
  const renders = new Map<string, number>();

  // Memoised, like a node's controls: any render it does is the store's.
  const Control = memo(function Control({ id }: { id: string }) {
    renders.set(id, (renders.get(id) ?? 0) + 1);
    const disabled = useSelectionDisablesControls(id);
    return <button data-id={id} disabled={disabled} />;
  });

  function Selection({ ids, children }: { ids: ReadonlySet<string>; children: ReactNode }) {
    useSyncSelectionControls(ids, true);
    return <>{children}</>;
  }

  function Canvas({ ids }: { ids: ReadonlySet<string> }) {
    return (
      <Selection ids={ids}>
        <Control id="a" />
        <Control id="b" />
        <Control id="c" />
      </Selection>
    );
  }

  it("re-renders the controls whose answer changed, and only those", () => {
    renders.clear();
    const view = render(
      <ReactFlowProvider>
        <Canvas ids={new Set()} />
      </ReactFlowProvider>,
    );
    const disabled = () =>
      [...view.container.querySelectorAll("button")].map((button) => button.disabled);
    expect(disabled()).toEqual([false, false, false]);

    view.rerender(
      <ReactFlowProvider>
        <Canvas ids={new Set(["a"])} />
      </ReactFlowProvider>,
    );
    expect(disabled()).toEqual([false, true, true]);

    renders.clear();
    act(() => {
      view.rerender(
        <ReactFlowProvider>
          <Canvas ids={new Set(["b"])} />
        </ReactFlowProvider>,
      );
    });
    expect(disabled()).toEqual([true, false, true]);
    expect(renders.get("a")).toBe(1);
    expect(renders.get("b")).toBe(1);
    expect(renders.has("c")).toBe(false);
  });

  it("answers false on a surface that never syncs a selection", () => {
    const { result } = renderHook(() => useSelectionDisablesControls("a"), {
      wrapper: ({ children }) => <ReactFlowProvider>{children}</ReactFlowProvider>,
    });
    expect(result.current).toBe(false);
  });
});
