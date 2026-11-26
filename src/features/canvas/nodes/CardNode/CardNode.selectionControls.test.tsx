import { render } from "@testing-library/react";
import { ReactFlowProvider, type Node, type NodeProps } from "@xyflow/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSyncSelectionControls } from "../../selection/selectionControls";
import CardNode from "./index";
import type { NodeData } from "./types";
import { isCardExpanded } from "./expandedCards";

/**
 * While another node is selected, a card's handles, links and buttons are off.
 * The card reads that through its controls, not through its data: a selection
 * change must not re-render the card itself (on a 1000-node diagram, the first
 * selection re-ran every card on the canvas).
 */

const cardRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/features/canvas/components/icons/componentIconLookupContext", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/canvas/components/icons/componentIconLookupContext")
    >();
  return {
    ...actual,
    useResolvedComponentIcon: (...args: Parameters<typeof actual.useResolvedComponentIcon>) => {
      cardRenders.count += 1;
      return actual.useResolvedComponentIcon(...args);
    },
  };
});

const data: NodeData = {
  elementId: "c1",
  name: "Orders",
  type: "container",
  description: "",
  isSelected: false,
  linkedDiagramName: "Inside orders",
  onDrillDown: () => {},
};

const props: NodeProps<Node<NodeData>> = {
  id: "c1",
  type: "container",
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

function renderCard(ids: ReadonlySet<string>, cardData: NodeData = data) {
  return (
    <MemoryRouter>
      <ReactFlowProvider>
        <Selection ids={ids}>
          <CardNode {...props} data={cardData} />
        </Selection>
      </ReactFlowProvider>
    </MemoryRouter>
  );
}

function drillDown(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector("button");
  if (!button) throw new Error("no drill-down button");
  return button;
}

describe("CardNode controls and the selection", () => {
  it("turns its controls off while another node is selected, without rendering the card", () => {
    const view = render(renderCard(new Set()));
    expect(drillDown(view.container).tabIndex).toBe(0);
    cardRenders.count = 0;

    view.rerender(renderCard(new Set(["other"])));
    expect(drillDown(view.container).tabIndex).toBe(-1);
    expect(drillDown(view.container).className).toContain("pointer-events-none");

    view.rerender(renderCard(new Set()));
    expect(drillDown(view.container).tabIndex).toBe(0);
    expect(cardRenders.count).toBe(0);
  });

  it("keeps its controls on while it is part of the selection", () => {
    const view = render(renderCard(new Set(["c1", "other"])));
    expect(drillDown(view.container).tabIndex).toBe(0);
  });

  it("keeps the controls off on a read-only surface, with nothing selected", () => {
    const view = render(renderCard(new Set(), { ...data, controlsDisabled: true }));
    expect(drillDown(view.container).tabIndex).toBe(-1);
  });
});

function cardBox(container: HTMLElement): HTMLElement {
  const card = container.querySelector<HTMLElement>("[aria-label]");
  if (!card) throw new Error("no card");
  return card;
}

/**
 * RT-041: the card declares the height the layout gave it on the editor as
 * well as on the reader — without letting its own measurement ratchet it up.
 */
describe("CardNode and the laid-out height", () => {
  const laidOut: NodeData = { ...data, laidOutMinHeight: 180 };

  it("draws at least the laid-out height", () => {
    const view = render(renderCard(new Set(), laidOut));
    expect(cardBox(view.container).style.minHeight).toBe("180px");
  });

  it("drops the floor once its content is edited, so it can shrink to it", () => {
    const view = render(renderCard(new Set(), laidOut));
    view.rerender(renderCard(new Set(), { ...laidOut, description: "shorter" }));
    expect(cardBox(view.container).style.minHeight).toBe("");
  });

  it("keeps the floor while only a passing state changes", () => {
    const view = render(renderCard(new Set(), laidOut));
    view.rerender(renderCard(new Set(), { ...laidOut, stepBadges: ["1"], isSelected: true }));
    expect(cardBox(view.container).style.minHeight).toBe("180px");
  });

  it("is marked expanded while active, so its expansion is not written back", () => {
    const view = render(renderCard(new Set(), { ...laidOut, isSelected: true }));
    expect(isCardExpanded("c1")).toBe(true);
    view.rerender(renderCard(new Set(), { ...laidOut, isSelected: false }));
    expect(isCardExpanded("c1")).toBe(false);
    view.unmount();
  });
});
