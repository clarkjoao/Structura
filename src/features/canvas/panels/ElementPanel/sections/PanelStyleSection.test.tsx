import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeLayout, PanelComponent } from "@/features/diagram";
import { PanelStyleSection } from "./PanelStyleSection";

/**
 * Width and height have one owner: the Advanced footer's `PositionSection`. This section used to
 * carry a second pair — same layout, different commit semantics — so a panel showed two
 * inputs for one value.
 */

const panel = {
  id: "p1",
  name: "Boundary",
  type: "panel",
  parentId: null,
} as unknown as PanelComponent;

const layout: NodeLayout = { elementId: "p1", x: 0, y: 0, width: 1860, height: 933 };

describe("PanelStyleSection", () => {
  it("renders no size fields, for a default panel", () => {
    render(
      <PanelStyleSection
        component={panel}
        updateComponent={vi.fn()}
        updateNodeLayout={vi.fn()}
        componentNodeLayout={layout}
      />,
    );
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });

  it("renders no size fields, for a swimlane", () => {
    render(
      <PanelStyleSection
        component={{ ...panel, panelKind: "swimlane" } as unknown as PanelComponent}
        updateComponent={vi.fn()}
        updateNodeLayout={vi.fn()}
        componentNodeLayout={layout}
      />,
    );
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });
});
