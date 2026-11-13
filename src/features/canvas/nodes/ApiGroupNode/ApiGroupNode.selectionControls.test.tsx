import { render } from "@testing-library/react";
import { ReactFlowProvider, type Node, type NodeProps } from "@xyflow/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSyncSelectionControls } from "../../selection/selectionControls";
import ApiGroupNode, { type ApiGroupNodeData } from "./index";

/**
 * While another node is selected, a group's footer offers the scripts running
 * through it instead of the button that adds a route. The footer reads that
 * itself: a selection change must not re-render the group around it.
 */

const groupRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/features/collaboration/hooks/useCollabHighlight", () => ({
  useCollabHighlight: () => {
    groupRenders.count += 1;
    return null;
  },
}));

const data: ApiGroupNodeData = {
  elementId: "g1",
  serviceName: "management",
  basePath: "/api/v1",
  protocol: "REST",
  isSelected: false,
  flows: [{ id: "f1", name: "Create URL" }],
  onAddEndpoint: () => {},
};

const props: NodeProps<Node<ApiGroupNodeData>> = {
  id: "g1",
  type: "api-group",
  data,
  selected: false,
  dragging: false,
  draggable: true,
  selectable: true,
  deletable: true,
  isConnectable: true,
  zIndex: 1,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

function Selection({ ids, children }: { ids: ReadonlySet<string>; children: ReactNode }) {
  useSyncSelectionControls(ids, true);
  return <>{children}</>;
}

function renderGroup(ids: ReadonlySet<string>, groupData: ApiGroupNodeData = data) {
  return (
    <ReactFlowProvider>
      <Selection ids={ids}>
        <ApiGroupNode {...props} data={groupData} />
      </Selection>
    </ReactFlowProvider>
  );
}

const addRoute = (container: HTMLElement) =>
  container.querySelector("button:not(.flow-play-control)");
const scripts = (container: HTMLElement) =>
  container.querySelector('[data-testid="api-group-scripts"]');

describe("ApiGroupNode footer and the selection", () => {
  it("swaps the add button for the scripts while another node is selected, without rendering the group", () => {
    const view = render(renderGroup(new Set()));
    expect(addRoute(view.container)).not.toBeNull();
    groupRenders.count = 0;

    view.rerender(renderGroup(new Set(["other"])));
    expect(addRoute(view.container)).toBeNull();
    expect(scripts(view.container)).not.toBeNull();

    view.rerender(renderGroup(new Set()));
    expect(addRoute(view.container)).not.toBeNull();
    expect(groupRenders.count).toBe(0);
  });

  it("keeps the add button while the group is part of the selection", () => {
    const view = render(renderGroup(new Set(["g1", "other"])));
    expect(addRoute(view.container)).not.toBeNull();
  });

  it("keeps the controls off on a read-only surface, with nothing selected", () => {
    const view = render(renderGroup(new Set(), { ...data, controlsDisabled: true }));
    expect(addRoute(view.container)).toBeNull();
    expect(scripts(view.container)).not.toBeNull();
  });
});
