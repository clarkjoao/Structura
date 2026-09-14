import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { ViewPage } from "./ViewPage";

/**
 * The reading route.
 *
 * `/view` is the surface the planned VSCode extension points a webview at: a
 * diagram opens, ELK arranges it, and nothing waits on a click. The two things
 * worth holding are exactly those — that the id in the query resolves to that
 * diagram and no other, and that the arrangement happens on load.
 */

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    private readonly cb: (entries: unknown[], self: unknown) => void;
    constructor(cb: (entries: unknown[], self: unknown) => void) {
      this.cb = cb;
    }
    observe(element: Element): void {
      this.cb([{ target: element, contentRect: { width: 200, height: 100 } }], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 100, width: 200, height: 100 };
  HTMLElement.prototype.getBoundingClientRect = () => rect as DOMRect;
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { get: () => 200, configurable: true },
    offsetHeight: { get: () => 100, configurable: true },
  });
});

function componentOf(id: string, name: string): Component {
  return { id, name, type: "system", parentId: null, description: "" } as unknown as Component;
}

/** Two nodes an edge apart, all stacked on one point so any layout has to move them. */
function diagramOf(id: string, name: string): Diagram {
  const components: Record<string, Component> = {
    [`${id}-a`]: componentOf(`${id}-a`, `${name} A`),
    [`${id}-b`]: componentOf(`${id}-b`, `${name} B`),
  };
  const connections: Record<string, Connection> = {
    [`${id}-e`]: {
      id: `${id}-e`,
      sourceId: `${id}-a`,
      targetId: `${id}-b`,
      label: "calls",
    } as unknown as Connection,
  };
  return {
    id,
    name,
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
    nodeLayouts: {
      [`${id}-a`]: { elementId: `${id}-a`, x: 0, y: 0, width: 180, height: 80 },
      [`${id}-b`]: { elementId: `${id}-b`, x: 0, y: 0, width: 180, height: 80 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as unknown as Diagram;
}

function seed(diagrams: Diagram[]): void {
  useDiagramStore.setState((state) => ({
    ...state,
    diagrams: Object.fromEntries(diagrams.map((d) => [d.id, d])),
  }));
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/view${search}`]}>
      <ViewPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  seed([diagramOf("alpha", "Alpha"), diagramOf("beta", "Beta")]);
});

describe("/view?diagramId", () => {
  it("renders the diagram the id names, and not the other one", async () => {
    renderAt("?diagramId=beta");

    expect(await screen.findByText("Beta A")).toBeInTheDocument();
    expect(screen.getByText("Beta B")).toBeInTheDocument();
    expect(screen.queryByText("Alpha A")).not.toBeInTheDocument();
  });

  it("says so when the id names nothing", async () => {
    renderAt("?diagramId=missing");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText("Alpha A")).not.toBeInTheDocument();
  });
});

describe("the layout runs on load", () => {
  /**
   * Both nodes are seeded at (0, 0). If anything is on screen at a position
   * other than the seeded one, a layout ran — and nothing was clicked to start
   * it, because this test never clicks.
   */
  it("arranges the diagram with no user interaction", async () => {
    const { container } = renderAt("?diagramId=alpha");
    await screen.findByText("Alpha A");

    await waitFor(() => {
      const placed = [...container.querySelectorAll<HTMLElement>(".react-flow__node")].map(
        (node) => node.style.transform,
      );
      expect(placed.length).toBe(2);
      expect(new Set(placed).size).toBe(2);
    });
  });

  it("leaves the stored diagram alone", async () => {
    renderAt("?diagramId=alpha");
    await screen.findByText("Alpha A");

    await waitFor(() => {
      const stored = useDiagramStore.getState().diagrams["alpha"]!;
      expect(stored.nodeLayouts["alpha-a"]).toEqual({
        elementId: "alpha-a",
        x: 0,
        y: 0,
        width: 180,
        height: 80,
      });
    });
  });
});
