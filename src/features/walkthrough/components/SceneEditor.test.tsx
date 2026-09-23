import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Diagram, Flow, FlowStep } from "@/features/diagram";
import { WALKTHROUGH_SCENE_DRAG_MIME } from "@/components/folders/dragTypes";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { SceneEditor } from "./SceneEditor";

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
  // jsdom lays nothing out, so every rect is zero and "below the midpoint" is
  // always true. One fixed 40px-tall rect makes the halves mean something.
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 40, width: 200, height: 40 }) as DOMRect;
});

function flow(id: string, name: string): Flow {
  return {
    id,
    name,
    mermaid: "",
    diagramId: "d-1",
    entryStepId: `${id}-s1`,
    steps: { [`${id}-s1`]: { id: `${id}-s1`, type: "action", title: name } as FlowStep },
  };
}

const D1 = {
  id: "d-1",
  name: "Merchant Platform",
  level: "container",
  createdAt: 0,
  updatedAt: 0,
  snapshot: {
    components: {},
    connections: {},
    flows: { "f-1": flow("f-1", "Criar cobrança"), "f-2": flow("f-2", "Entregar webhook") },
    iconLibrary: {},
  },
  nodeLayouts: {},
  edgeLayouts: {},
  viewport: { x: 0, y: 0, zoom: 1 },
} as unknown as Diagram;

const D_EMPTY = {
  id: "d-empty",
  name: "Catálogo de elementos",
  level: "container",
  createdAt: 0,
  updatedAt: 0,
  snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
  nodeLayouts: {},
  edgeLayouts: {},
  viewport: { x: 0, y: 0, zoom: 1 },
} as unknown as Diagram;

const ALL = { "d-1": D1, "d-empty": D_EMPTY };

vi.mock("@/features/diagram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/diagram")>()),
  useDiagrams: () => ALL,
  useDiagramStore: (selector: (s: { diagrams: Record<string, Diagram> }) => unknown) =>
    selector({ diagrams: ALL }),
}));

vi.mock("@/features/viewer", () => ({
  ViewerCanvas: () => <div data-testid="preview" />,
  useStoreReaderCatalog: () => undefined,
}));

const THREE_SCENES: WalkthroughPresentation = {
  id: "wt_1",
  title: "Tour",
  createdAt: 0,
  updatedAt: 0,
  folderId: null,
  steps: [
    { id: "st1", diagramId: "d-1", flowId: "f-1", label: "Um" },
    { id: "st2", diagramId: "d-1", flowId: "f-2", label: "Dois" },
    { id: "st3", diagramId: "d-1", flowId: "f-1", label: "Três" },
  ],
};

function renderEditor(presentation = THREE_SCENES) {
  const onUpdate = vi.fn();
  render(<SceneEditor presentation={presentation} onUpdate={onUpdate} />);
  return { onUpdate };
}

/** The row a scene's title sits in. */
function row(label: string): HTMLElement {
  const found = screen.getByText(label).closest("li");
  if (!found) throw new Error(`no row for "${label}"`);
  return found;
}

function labelsAfter(onUpdate: ReturnType<typeof vi.fn>): string[] {
  const calls = onUpdate.mock.calls;
  const last = calls[calls.length - 1] as [WalkthroughPresentation] | undefined;
  if (!last) throw new Error("onUpdate was never called");
  return last[0].steps.map((step) => step.label ?? "");
}

/** Drags `from` onto `onto`, landing above or below its midpoint. */
function dragOnto(from: string, onto: string, half: "top" | "bottom") {
  const source = row(from);
  const target = row(onto);
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "",
    dropEffect: "",
  };

  fireEvent.dragStart(source, { dataTransfer });

  // jsdom has no DragEvent, so testing-library builds a plain Event and drops
  // `clientY` on the floor — which reads as 0-and-undefined, i.e. always the
  // bottom half. Setting it on the event itself is what makes the halves real.
  const over = createEvent.dragOver(target, { dataTransfer });
  Object.defineProperty(over, "clientY", { value: half === "top" ? 5 : 35 });
  fireEvent(target, over);

  fireEvent.drop(target, { dataTransfer });
}

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("the scene rail reads as a sequence", () => {
  it("numbers the scenes in order", () => {
    renderEditor();

    expect(within(row("Um")).getByText("1")).toBeTruthy();
    expect(within(row("Dois")).getByText("2")).toBeTruthy();
    expect(within(row("Três")).getByText("3")).toBeTruthy();
  });

  it("says which diagram each scene reads from", () => {
    renderEditor();

    expect(within(row("Um")).getByText("Merchant Platform")).toBeTruthy();
  });

  it("marks a scene whose diagram is gone", () => {
    renderEditor({
      ...THREE_SCENES,
      steps: [{ id: "st4", diagramId: "d-missing", flowId: "f-1", label: "Órfã" }],
    });

    expect(within(row("Órfã")).getByText("Diagrama não encontrado")).toBeTruthy();
  });

  it("does not repeat the diagram and flow the right-hand pane already edits", () => {
    renderEditor();

    // The old rail showed both read-only under the selected scene, duplicating
    // the selects beside it. Only the diagram belongs here now.
    expect(within(row("Um")).queryByText("Criar cobrança")).toBeNull();
  });
});

describe("reordering by dragging", () => {
  it("moves a scene down when dropped below a later one", () => {
    const { onUpdate } = renderEditor();

    dragOnto("Um", "Três", "bottom");

    expect(labelsAfter(onUpdate)).toEqual(["Dois", "Três", "Um"]);
  });

  it("moves a scene up when dropped above an earlier one", () => {
    const { onUpdate } = renderEditor();

    dragOnto("Três", "Um", "top");

    expect(labelsAfter(onUpdate)).toEqual(["Três", "Um", "Dois"]);
  });

  it("does nothing when dropped back into its own gap", () => {
    const { onUpdate } = renderEditor();

    dragOnto("Dois", "Dois", "top");

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("carries the scene on its own drag type", () => {
    renderEditor();
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "",
    };

    fireEvent.dragStart(row("Dois"), { dataTransfer });

    expect(data.get(WALKTHROUGH_SCENE_DRAG_MIME)).toBe("1");
  });
});

describe("reordering without a pointer", () => {
  it("moves a scene up on ArrowUp from its handle", () => {
    const { onUpdate } = renderEditor();

    fireEvent.keyDown(within(row("Dois")).getByRole("button", { name: /Reordenar/ }), {
      key: "ArrowUp",
    });

    expect(labelsAfter(onUpdate)).toEqual(["Dois", "Um", "Três"]);
  });

  it("moves a scene down on ArrowDown", () => {
    const { onUpdate } = renderEditor();

    fireEvent.keyDown(within(row("Dois")).getByRole("button", { name: /Reordenar/ }), {
      key: "ArrowDown",
    });

    expect(labelsAfter(onUpdate)).toEqual(["Um", "Três", "Dois"]);
  });

  it("stays put at the ends", () => {
    const { onUpdate } = renderEditor();

    fireEvent.keyDown(within(row("Um")).getByRole("button", { name: /Reordenar/ }), {
      key: "ArrowUp",
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("removing a scene", () => {
  it("drops it from the sequence", () => {
    const { onUpdate } = renderEditor();

    fireEvent.click(within(row("Dois")).getByTitle("Remover cena"));

    expect(labelsAfter(onUpdate)).toEqual(["Um", "Três"]);
  });

  it("does not select the scene on the way", () => {
    const { onUpdate } = renderEditor();

    fireEvent.click(within(row("Três")).getByTitle("Remover cena"));

    expect(labelsAfter(onUpdate)).toEqual(["Um", "Dois"]);
  });
});

describe("the inspector states what the scene points at", () => {
  it("says which scene of how many is being edited", () => {
    renderEditor();

    expect(screen.getByText("Cena 1 de 3")).toBeTruthy();
  });

  it("follows the selection", () => {
    renderEditor();

    fireEvent.click(screen.getByText("Três"));

    expect(screen.getByText("Cena 3 de 3")).toBeTruthy();
  });
});

describe("a scene that cannot play says so", () => {
  it("warns when the chosen diagram has no flows", () => {
    renderEditor({
      ...THREE_SCENES,
      steps: [{ id: "st5", diagramId: "d-empty", flowId: "", label: "Sem fluxo" }],
    });

    // The old form put this in a 10px grey footnote under a disabled select,
    // while the rail showed the sibling failure in red. They agree now.
    expect(screen.getByText(/Esta cena não vai tocar/)).toBeTruthy();
  });

  it("does not warn when the diagram has flows", () => {
    renderEditor();

    expect(screen.queryByText(/Esta cena não vai tocar/)).toBeNull();
  });

  it("warns in the inspector when the diagram is gone, as the rail does", () => {
    renderEditor({
      ...THREE_SCENES,
      steps: [{ id: "st6", diagramId: "d-missing", flowId: "f-1", label: "Órfã" }],
    });

    // Once in the rail, once under the diagram select, once in place of the
    // preview — every column agrees the scene is broken.
    expect(screen.getAllByText("Diagrama não encontrado").length).toBeGreaterThan(1);
  });
});
