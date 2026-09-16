import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeLayout } from "@/features/diagram";
import { PositionSection } from "./PositionSection";

function layout(x: number, y: number): NodeLayout {
  return { elementId: "c1", x, y };
}

function renderSection(nodeLayout: NodeLayout, updateNodeLayout: (...args: never[]) => void) {
  return render(
    <PositionSection
      componentId="c1"
      nodeLayout={nodeLayout}
      updateNodeLayout={updateNodeLayout as unknown as PositionSectionUpdate}
      isPanel={false}
    />,
  );
}

type PositionSectionUpdate = (
  elementId: string,
  position: { x: number; y: number },
  dimensions?: { width: number; height: number },
  options?: { syncCanvas?: boolean },
) => void;

const inputs = () => screen.getAllByRole("spinbutton") as HTMLInputElement[];
const xField = () => inputs()[0];
const yField = () => inputs()[1];

describe("PositionSection", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // The panel used to auto-commit on a timer that re-armed on every nodeLayout
  // identity change. A drag hands it a fresh, fractional layout; the fields round
  // it and wrote the rounded value straight back, which changed the layout again.
  // That write racing the ResizeObserver layout write is the ping-pong that made a
  // dragged node oscillate between its new and old position indefinitely.
  // Nothing may reach the store unless the user actually edits a field.
  it("writes nothing to the store when the node moves underneath it", () => {
    vi.useFakeTimers();
    const updateNodeLayout = vi.fn();
    const { rerender } = render(
      <PositionSection
        componentId="c1"
        nodeLayout={layout(1400, 380)}
        updateNodeLayout={updateNodeLayout}
        isPanel={false}
      />,
    );

    // a drag lands the node on a fractional position, as React Flow reports it
    act(() => {
      rerender(
        <PositionSection
          componentId="c1"
          nodeLayout={layout(1785.4, 360.2)}
          updateNodeLayout={updateNodeLayout}
          isPanel={false}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(updateNodeLayout).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("commits on blur", () => {
    const updateNodeLayout = vi.fn();
    renderSection(layout(1400, 380), updateNodeLayout);

    fireEvent.change(xField(), { target: { value: "1500" } });
    fireEvent.blur(xField());

    expect(updateNodeLayout).toHaveBeenCalledTimes(1);
    expect(updateNodeLayout).toHaveBeenCalledWith("c1", { x: 1500, y: 380 }, undefined, {
      syncCanvas: true,
    });
  });

  it("commits on Enter", () => {
    const updateNodeLayout = vi.fn();
    renderSection(layout(1400, 380), updateNodeLayout);

    fireEvent.change(yField(), { target: { value: "420" } });
    fireEvent.keyDown(yField(), { key: "Enter" });

    expect(updateNodeLayout).toHaveBeenCalledTimes(1);
    expect(updateNodeLayout).toHaveBeenCalledWith("c1", { x: 1400, y: 420 }, undefined, {
      syncCanvas: true,
    });
  });

  it("asks the canvas to drop its local position on size edits too", () => {
    const updateNodeLayout = vi.fn();
    render(
      <PositionSection
        componentId="c1"
        nodeLayout={{ elementId: "c1", x: 10, y: 20, width: 200, height: 150 }}
        updateNodeLayout={updateNodeLayout}
        isPanel
      />,
    );

    const [x, , w] = inputs();
    fireEvent.change(x, { target: { value: "40" } });
    fireEvent.change(w, { target: { value: "300" } });
    fireEvent.blur(w);

    expect(updateNodeLayout).toHaveBeenCalledWith(
      "c1",
      { x: 40, y: 20 },
      { width: 300, height: 150 },
      { syncCanvas: true },
    );
  });

  it("does not overwrite a field the user is editing", () => {
    const updateNodeLayout = vi.fn();
    const { rerender } = render(
      <PositionSection
        componentId="c1"
        nodeLayout={layout(1400, 380)}
        updateNodeLayout={updateNodeLayout}
        isPanel={false}
      />,
    );

    fireEvent.focus(xField());
    fireEvent.change(xField(), { target: { value: "999" } });

    act(() => {
      rerender(
        <PositionSection
          componentId="c1"
          nodeLayout={layout(1785, 360)}
          updateNodeLayout={updateNodeLayout}
          isPanel={false}
        />,
      );
    });

    expect(xField().value).toBe("999");
  });

  it("follows the store while no field is focused", () => {
    const updateNodeLayout = vi.fn();
    const { rerender } = render(
      <PositionSection
        componentId="c1"
        nodeLayout={layout(1400, 380)}
        updateNodeLayout={updateNodeLayout}
        isPanel={false}
      />,
    );

    expect(xField().value).toBe("1400");

    act(() => {
      rerender(
        <PositionSection
          componentId="c1"
          nodeLayout={layout(1785, 360)}
          updateNodeLayout={updateNodeLayout}
          isPanel={false}
        />,
      );
    });

    expect(xField().value).toBe("1785");
    expect(yField().value).toBe("360");
  });
});
