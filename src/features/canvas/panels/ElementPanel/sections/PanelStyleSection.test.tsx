import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeLayout, PanelComponent } from "@/features/diagram";
import { PanelStyleSection } from "./PanelStyleSection";

/**
 * The size fields must write only what the user typed.
 *
 * They show the layout rounded, and used to commit on a timer armed by every
 * render — so merely showing the inspector wrote the rounded size back. A panel
 * the layout sized at 933.333 became 933 while the canvas kept drawing
 * 933.333: the editor no longer matched its own store, and every reader of the
 * store (the viewer) drew a different box. Same class as the PositionSection
 * ping-pong, whose test this mirrors.
 */

const panel = {
  id: "p1",
  name: "Boundary",
  type: "panel",
  parentId: null,
} as unknown as PanelComponent;

function layout(width: number, height: number): NodeLayout {
  return { elementId: "p1", x: 0, y: 0, width, height };
}

function renderSection(nodeLayout: NodeLayout, updateNodeLayout = vi.fn()) {
  render(
    <PanelStyleSection
      component={panel}
      updateComponent={vi.fn()}
      updateNodeLayout={updateNodeLayout}
      componentNodeLayout={nodeLayout}
    />,
  );
  return updateNodeLayout;
}

const sizeFields = () => screen.getAllByRole("spinbutton") as HTMLInputElement[];

describe("PanelStyleSection size fields", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing when the layout it shows is fractional and nobody typed", () => {
    const updateNodeLayout = renderSection(layout(1860, 933.3333333333334));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(updateNodeLayout).not.toHaveBeenCalled();
  });

  it("still writes a size the user typed", () => {
    const updateNodeLayout = renderSection(layout(1860, 933.3333333333334));
    const [, height] = sizeFields();

    fireEvent.change(height, { target: { value: "1000" } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(updateNodeLayout).toHaveBeenCalledTimes(1);
    expect(updateNodeLayout).toHaveBeenCalledWith(
      "p1",
      { x: 0, y: 0 },
      { width: 1860, height: 1000 },
    );
  });

  it("does not carry an edit over to the next selected panel", () => {
    const updateNodeLayout = vi.fn();
    const props = { updateComponent: vi.fn(), updateNodeLayout };
    const { rerender } = render(
      <PanelStyleSection {...props} component={panel} componentNodeLayout={layout(800, 600)} />,
    );
    const [width] = sizeFields();

    fireEvent.change(width, { target: { value: "900" } });
    // Selecting another panel before the edit commits: its size is fractional,
    // so a commit armed by the first panel's edit would round it.
    const other = { ...panel, id: "p2" } as PanelComponent;
    rerender(
      <PanelStyleSection
        {...props}
        component={other}
        componentNodeLayout={{ ...layout(1860, 933.3333333333334), elementId: "p2" }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(updateNodeLayout).not.toHaveBeenCalledWith("p2", expect.anything(), expect.anything());
  });
});

describe("a swimlane's stroke", () => {
  const lane = {
    id: "l1",
    name: "Evidence",
    type: "panel",
    panelKind: "swimlane",
    parentId: null,
    swimlane: { orientation: "horizontal", laneColor: "#6366f1", laneLabel: "Evidence" },
  } as unknown as PanelComponent;

  it("writes dashed into the panel's borderStyle and clears it for solid", () => {
    const updateComponent = vi.fn();
    render(
      <PanelStyleSection
        component={lane}
        updateComponent={updateComponent}
        updateNodeLayout={vi.fn()}
        componentNodeLayout={undefined}
      />,
    );
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[radios.length - 1]);
    expect(updateComponent).toHaveBeenLastCalledWith("l1", { borderStyle: "dashed" });
    fireEvent.click(radios[radios.length - 2]);
    expect(updateComponent).toHaveBeenLastCalledWith("l1", { borderStyle: undefined });
  });
});
