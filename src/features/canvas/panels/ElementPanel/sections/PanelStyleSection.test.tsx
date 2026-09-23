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
});
