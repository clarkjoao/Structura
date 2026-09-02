import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import type { Component, Diagram, Flow, SceneDiff } from "@/features/diagram";
import { ViewerCanvas } from "./components/ViewerCanvas";

/**
 * The reading, in the viewer.
 *
 * The mechanism is the editor's — the same navigator, the same playback state
 * machine, the same counter. What is new is that it works with a diagram that
 * arrived in a link instead of one sitting in the store.
 */

/**
 * React Flow draws nothing in jsdom without measurement. The hazard this repo
 * has hit before: a stub whose callback never fires leaves every assertion
 * passing over an empty canvas — so "renders the diagram's nodes at all" below
 * is what stops these tests being green over nothing.
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
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON() {},
  };
  HTMLElement.prototype.getBoundingClientRect = () => rect as DOMRect;
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { get: () => 200, configurable: true },
    offsetHeight: { get: () => 100, configurable: true },
  });
});

const component = (id: string, name: string) =>
  ({ id, name, type: "system", parentId: null }) as unknown as Component;

const CHECKOUT: Flow = {
  id: "f1",
  name: "Checkout",
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: {
    s1: {
      id: "s1",
      type: "action",
      next: "c",
      componentId: "c1",
      title: "The ask",
      note: "Only the happy path.",
    },
    c: {
      id: "c",
      type: "condition",
      conditionLabel: "Authorised?",
      branches: [
        { label: "Yes", nextId: "a" },
        { label: "No", nextId: "b" },
      ],
    },
    a: { id: "a", type: "action", next: "join", componentId: "c2", title: "Ledger" },
    b: { id: "b", type: "action", next: "join", title: "Fallback" },
    join: { id: "join", type: "action", title: "Notify" },
  },
};

const REFUND: Flow = {
  id: "f2",
  name: "Refund",
  mermaid: "",
  diagramId: "d1",
  entryStepId: "r1",
  steps: { r1: { id: "r1", type: "action", componentId: "c2", title: "Refund asked" } },
};

function diagramWith(flows: Flow[], scenes?: Record<string, SceneDiff>): Diagram {
  return {
    id: "d1",
    name: "Checkout",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { c1: component("c1", "Gateway"), c2: component("c2", "Ledger") },
      connections: {},
      flows: Object.fromEntries(flows.map((f) => [f.id, f])),
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: scenes ?? {},
    activeSceneId: null,
  } as unknown as Diagram;
}

function open(diagram: Diagram) {
  // The node components reach for a router (a badge links to a referenced
  // diagram), which the app provides and a bare render does not.
  return render(
    <MemoryRouter>
      <ViewerCanvas diagram={diagram} showOpenInStructuraButton={false} />
    </MemoryRouter>,
  );
}

const startReading = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

const progress = () => screen.getByTestId("flow-progress").textContent?.replace(/\s+/g, " ");

describe("choosing a script starts the reading", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows nothing of the reading until a script is chosen", () => {
    open(diagramWith([CHECKOUT]));

    expect(screen.queryByTestId("flow-progress")).not.toBeInTheDocument();
    expect(screen.getByTestId("viewer-flow-invite")).toBeInTheDocument();
  });

  it("puts the invite away and opens the reading", () => {
    open(diagramWith([CHECKOUT]));

    startReading("Checkout");

    expect(screen.queryByTestId("viewer-flow-invite")).not.toBeInTheDocument();
    expect(screen.getByTestId("flow-progress")).toBeInTheDocument();
  });

  it("reads the step's own title and note, from a diagram that came in a link", () => {
    open(diagramWith([CHECKOUT]));

    startReading("Checkout");

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("The ask");
    expect(screen.getByText("Only the happy path.")).toBeInTheDocument();
  });

  it("counts the path, not the script", () => {
    open(diagramWith([CHECKOUT]));

    startReading("Checkout");

    // Five steps in the script; every reading of it is four, and a choice is ahead.
    expect(progress()).toBe("1 / 4+ · 5");
  });

  it("offers the branches at the condition and follows the one chosen", () => {
    open(diagramWith([CHECKOUT]));
    startReading("Checkout");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("Fallback");
    expect(progress()).toBe("3 / 4 · 5");
  });

  it("starts a script from its first step", () => {
    open(diagramWith([CHECKOUT, REFUND]));

    startReading("Refund");

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("Refund asked");
    expect(progress()).toBe("1 / 1");
  });
});

describe("the reading is read against the diagram that arrived", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("says the element is gone when the diagram in the link does not have it", () => {
    const ghost: Flow = {
      ...REFUND,
      steps: { r1: { id: "r1", type: "action", componentId: "not-in-this-diagram" } },
    };
    open(diagramWith([ghost]));

    startReading("Refund");

    expect(screen.getByTestId("flow-step-element-state")).toHaveTextContent("no longer has");
  });

  it("says nothing when the element is right there in the link's diagram", () => {
    open(diagramWith([REFUND]));

    startReading("Refund");

    expect(screen.queryByTestId("flow-step-element-state")).not.toBeInTheDocument();
  });
});

describe("the canvas shows where the reader is", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  const opacityOf = (container: HTMLElement, id: string) =>
    (container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null)?.style
      .opacity;

  it("leaves every node at full strength before a script is chosen", () => {
    const { container } = open(diagramWith([CHECKOUT]));

    expect([opacityOf(container, "c1"), opacityOf(container, "c2")]).toEqual(["", ""]);
  });

  it("brings the step in hand forward and lets the rest recede", () => {
    const { container } = open(diagramWith([CHECKOUT]));

    startReading("Checkout");

    // c1 is the step in hand; c2 the flow visits later.
    expect(opacityOf(container, "c1")).toBe("1");
    expect(opacityOf(container, "c2")).toBe("0.5");
  });

  it("moves the light along as the reader advances", () => {
    const { container } = open(diagramWith([CHECKOUT]));
    startReading("Checkout");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    // The step in hand is now the one on c2; c1 is behind the reader.
    expect(opacityOf(container, "c2")).toBe("1");
    expect(opacityOf(container, "c1")).toBe("0.85");
  });
});

describe("leaving and switching, without losing the diagram", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("goes back to a clean canvas and offers the invite again", () => {
    open(diagramWith([CHECKOUT]));
    startReading("Checkout");

    fireEvent.click(screen.getByTitle("Exit flow"));

    expect(screen.queryByTestId("flow-progress")).not.toBeInTheDocument();
    expect(screen.getByTestId("viewer-flow-invite")).toBeInTheDocument();
  });

  it("moves to another script without going back to the invite", () => {
    open(diagramWith([CHECKOUT, REFUND]));
    startReading("Checkout");

    fireEvent.click(screen.getByTitle("Read another script"));
    fireEvent.click(screen.getByRole("button", { name: "Refund" }));

    expect(screen.queryByTestId("viewer-flow-invite")).not.toBeInTheDocument();
    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("Refund asked");
  });

  it("offers no switcher when the diagram has a single script", () => {
    open(diagramWith([CHECKOUT]));

    startReading("Checkout");

    expect(screen.queryByTitle("Read another script")).not.toBeInTheDocument();
  });
});

describe("the canvas is numbered by the script that is open", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  const badgeText = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-testid="node-step-badges"]')].map((n) =>
      n.textContent?.trim(),
    );

  it("renders the diagram's nodes at all, so the checks below mean something", () => {
    const { container } = open(diagramWith([CHECKOUT]));

    expect(container.querySelectorAll(".react-flow__node").length).toBe(2);
  });

  it("carries no number before a script is chosen", () => {
    const { container } = open(diagramWith([CHECKOUT]));

    expect(badgeText(container)).toEqual([]);
  });

  it("numbers the nodes the open script walks through", () => {
    const { container } = open(diagramWith([CHECKOUT]));

    startReading("Checkout");

    expect(badgeText(container).join("|")).toContain("1");
  });

  it("drops the numbers again when the reading is left", () => {
    const { container } = open(diagramWith([CHECKOUT]));
    startReading("Checkout");
    expect(badgeText(container).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTitle("Exit flow"));

    expect(badgeText(container)).toEqual([]);
  });
});
