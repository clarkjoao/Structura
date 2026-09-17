import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { generateViewerUrl } from "@/lib/share-url";
import { ViewerPage } from "./ViewerPage";

/**
 * Diagrams render as authored — no layout runs on any path.
 *
 * A diagram that arrives with its positions was arranged by whoever is sharing
 * it, and re-arranging it would replace the picture they are sharing with a
 * different one. All paths — hash, `postMessage`, `?diagramId`, and
 * `?source=file` — render what they were given.
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

/** Two nodes an edge apart, both parked on the origin so any layout has to move them. */
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

function renderAt(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/viewer${search}`]}>
      <ViewerPage />
    </MemoryRouter>,
  );
}

/** Node positions as React Flow wrote them to the DOM. */
function placements(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".react-flow__node")].map(
    (node) => node.style.transform,
  );
}

beforeEach(() => {
  window.location.hash = "";
  useDiagramStore.setState((state) => ({
    ...state,
    diagrams: { alpha: diagramOf("alpha", "Alpha"), beta: diagramOf("beta", "Beta") },
  }));
});

describe("the share link still works", () => {
  it("loads a diagram out of the #data= hash", async () => {
    const shared = diagramOf("shared", "Shared");
    window.location.hash = new URL(generateViewerUrl(shared)).hash;

    renderAt();

    expect(await screen.findByText("Shared A")).toBeInTheDocument();
    expect(screen.getByText("Shared B")).toBeInTheDocument();
  });

  /**
   * The payload carries the positions the author arranged. Arranging it again
   * would replace the picture being shared with a different one.
   */
  it("renders a shared diagram where it was authored, with no layout run", async () => {
    const shared = diagramOf("shared", "Shared");
    window.location.hash = new URL(generateViewerUrl(shared)).hash;

    const { container } = renderAt();
    await screen.findByText("Shared A");

    // Both nodes were authored at the origin; nothing should have moved them.
    await waitFor(() => expect(placements(container)).toHaveLength(2));
    expect(new Set(placements(container)).size).toBe(1);
  });
});

describe("the postMessage protocol still works", () => {
  it("announces itself and renders what STRUCTURA_LOAD hands it", async () => {
    const announced: unknown[] = [];
    const realPost = window.parent.postMessage.bind(window.parent);
    window.parent.postMessage = ((message: unknown) => {
      announced.push(message);
    }) as typeof window.parent.postMessage;

    try {
      renderAt();
      await waitFor(() =>
        expect(announced).toContainEqual(expect.objectContaining({ type: "STRUCTURA_READY" })),
      );

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "STRUCTURA_LOAD", diagram: diagramOf("sent", "Sent") },
          }),
        );
      });

      expect(await screen.findByText("Sent A")).toBeInTheDocument();
    } finally {
      window.parent.postMessage = realPost;
    }
  });
});

describe("the ?diagramId= and ?source=file sources", () => {
  it("loads the diagram ?diagramId= names, and not the other one", async () => {
    renderAt("?diagramId=beta");

    expect(await screen.findByText("Beta A")).toBeInTheDocument();
    expect(screen.getByText("Beta B")).toBeInTheDocument();
    expect(screen.queryByText("Alpha A")).not.toBeInTheDocument();
  });

  it("says so when the id names nothing", async () => {
    renderAt("?diagramId=missing");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  /**
   * The diagram is rendered as stored. Both nodes were stored at (0, 0); no
   * layout runs, so both stay there.
   */
  it("renders a diagram named by id as authored, with no layout run", async () => {
    const { container } = renderAt("?diagramId=alpha");
    await screen.findByText("Alpha A");

    await waitFor(() => expect(placements(container)).toHaveLength(2));
    expect(new Set(placements(container)).size).toBe(1);
  });

  it("leaves the stored diagram alone", async () => {
    renderAt("?diagramId=alpha");
    await screen.findByText("Alpha A");

    await waitFor(() => {
      expect(useDiagramStore.getState().diagrams["alpha"]!.nodeLayouts["alpha-a"]).toEqual({
        elementId: "alpha-a",
        x: 0,
        y: 0,
        width: 180,
        height: 80,
      });
    });
  });

  /**
   * jsdom has no File System Access API, so the picker branch is only
   * reachable with it stubbed — which is also what the route checks before
   * offering the button. Without the stub the route correctly says the browser
   * cannot open local files, and that is asserted too.
   */
  it("offers the file picker for ?source=file, naming the path it was given", async () => {
    const withPicker = window as unknown as { showOpenFilePicker?: unknown };
    withPicker.showOpenFilePicker = () => Promise.resolve([]);
    try {
      renderAt("?source=file&path=/tmp/arch.structura.json");
      expect(await screen.findByText("/tmp/arch.structura.json")).toBeInTheDocument();
    } finally {
      delete withPicker.showOpenFilePicker;
    }
  });

  it("says so when the browser cannot open local files", async () => {
    renderAt("?source=file&path=/tmp/arch.structura.json");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
