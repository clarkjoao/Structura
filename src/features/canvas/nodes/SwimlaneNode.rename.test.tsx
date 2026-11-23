import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type Node, type NodeProps } from "@xyflow/react";
import SwimlaneNode, { type SwimlaneNodeData } from "./SwimlaneNode";
import { LaneRenameContext } from "../contexts/LaneRenameContext";

const props = {
  id: "lane",
  data: {
    elementId: "lane",
    name: "System",
    orientation: "horizontal",
    laneColor: "#6366f1",
    laneLabel: "System",
    isSelected: false,
  },
  selected: false,
  dragging: false,
} as unknown as NodeProps<Node<SwimlaneNodeData>>;

function renderLane(rename: ((id: string, name: string) => void) | null) {
  return render(
    <ReactFlowProvider>
      <LaneRenameContext.Provider value={rename}>
        <SwimlaneNode {...props} />
      </LaneRenameContext.Provider>
    </ReactFlowProvider>,
  );
}

describe("renaming a lane from its header", () => {
  it("edits in place: Enter renames, Esc cancels", () => {
    const rename = vi.fn();
    renderLane(rename);
    fireEvent.doubleClick(screen.getByTestId("swimlane-header"));
    const input = screen.getByTestId("swimlane-header-input");
    fireEvent.change(input, { target: { value: "API" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(rename).toHaveBeenCalledWith("lane", "API");
    fireEvent.doubleClick(screen.getByTestId("swimlane-header"));
    fireEvent.change(screen.getByTestId("swimlane-header-input"), { target: { value: "X" } });
    fireEvent.keyDown(screen.getByTestId("swimlane-header-input"), { key: "Escape" });
    expect(rename).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("swimlane-header-input")).toBeNull();
  });

  it("offers no editor without a rename (freehand, read-only)", () => {
    renderLane(null);
    fireEvent.doubleClick(screen.getByTestId("swimlane-header"));
    expect(screen.queryByTestId("swimlane-header-input")).toBeNull();
  });
});
