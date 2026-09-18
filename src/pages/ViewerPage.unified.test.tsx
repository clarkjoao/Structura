import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { generateViewerUrl } from "@/lib/share-url";
import type { FileSourceState } from "@/features/viewer/hooks/useStructuraFile";
import { ViewerPage } from "./ViewerPage";

/**
 * One reading route.
 *
 * `/viewer` and `/view` were two routes with near-identical names and
 * overlapping jobs. `/viewer` keeps the name — it is the one already written
 * into shared links (`generateViewerUrl` emits `/viewer#data=`) and into the
 * iframe snippets `EmbedModal` hands out, so it is the name that is already
 * out in the world — and it absorbs what `/view` could do.
 *
 * The line this file holds: no source is re-arranged. A share link, an embed
 * handing a diagram over by `postMessage`, a diagram named by id and one read
 * off disk all render at the positions they carry. The viewer used to run ELK
 * on the last two, which threw away the author's positions and waypoints and
 * drew a different picture from the editor's
 * (docs/investigation/divergencia-edicao-visualizacao.md §3.5). An author who
 * wants an arranged diagram runs auto layout in the editor and saves it.
 */

/**
 * A file the test hands the route, or `null` for the real hook. The picker
 * tests below need the real one: they assert what it offers without the API.
 */
const fileOverride: { current: FileSourceState | null } = { current: null };

vi.mock("@/features/viewer/hooks/useStructuraFile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/viewer/hooks/useStructuraFile")>();
  return {
    ...actual,
    useStructuraFile: () =>
      fileOverride.current
        ? { state: fileOverride.current, pick: async () => {}, supported: true }
        : actual.useStructuraFile(),
  };
});

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

/**
 * A diagram saved with its nodes somewhere no layout engine would put them: an
 * arrangement that survives rendering was not re-arranged.
 */
function savedAt(id: string, name: string): Diagram {
  const diagram = diagramOf(id, name);
  return {
    ...diagram,
    nodeLayouts: {
      [`${id}-a`]: { elementId: `${id}-a`, x: 37, y: 411, width: 180, height: 80 },
      [`${id}-b`]: { elementId: `${id}-b`, x: 653, y: 29, width: 180, height: 80 },
    },
  };
}

const SAVED_PLACEMENTS = ["translate(37px,411px)", "translate(653px,29px)"];

/** Long enough for an async layout (ELK is a dynamic import) to land if one ran. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));

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
    diagrams: { alpha: savedAt("alpha", "Alpha"), beta: diagramOf("beta", "Beta") },
  }));
});

afterEach(() => {
  fileOverride.current = null;
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

describe("the sources /view used to own", () => {
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
   * The editor draws a stored diagram at its saved positions; so does the
   * viewer. Before this, ELK re-arranged it on load and the two disagreed.
   */
  it("renders a diagram named by id where it was saved, with no layout run", async () => {
    const { container } = renderAt("?diagramId=alpha");
    await screen.findByText("Alpha A");
    await settle();

    expect(placements(container).sort()).toEqual(SAVED_PLACEMENTS);
  });

  it("leaves the stored diagram alone", async () => {
    renderAt("?diagramId=alpha");
    await screen.findByText("Alpha A");

    await waitFor(() => {
      expect(useDiagramStore.getState().diagrams["alpha"]!.nodeLayouts["alpha-a"]).toEqual({
        elementId: "alpha-a",
        x: 37,
        y: 411,
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

  it("renders a diagram read off disk where it was saved, with no layout run", async () => {
    fileOverride.current = { status: "ready", diagram: savedAt("disk", "Disk"), readAt: 0 };

    const { container } = renderAt("?source=file&path=/tmp/arch.structura.json");
    await screen.findByText("Disk A");
    await settle();

    expect(placements(container).sort()).toEqual(SAVED_PLACEMENTS);
  });

  it("says so when the browser cannot open local files", async () => {
    renderAt("?source=file&path=/tmp/arch.structura.json");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
