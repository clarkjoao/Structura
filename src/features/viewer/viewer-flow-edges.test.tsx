import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import type { Component, Diagram, Flow, FlowStep } from "@/features/diagram";
import { ViewerCanvas } from "./components/ViewerCanvas";

/**
 * The edges of a reading, reported rather than acted on.
 *
 * The viewer holds the reading in its own state, so nothing above it could see
 * that a script had run out — which is why the walkthrough player grew a second
 * set of ⌘-modified keys to cross a scene. These callbacks are the edge of the
 * reading stated out loud; what lies beyond it stays the host's decision.
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

const box = () =>
  ({ id: "c1", type: "container", name: "api", parentId: null }) as unknown as Component;

/** Two steps: s1 → s2, and s2 is the last. */
const TWO_STEPS: Flow = {
  id: "f1",
  name: "Create",
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: {
    s1: { id: "s1", type: "action", title: "first", next: "s2" } as FlowStep,
    s2: { id: "s2", type: "action", title: "second" } as FlowStep,
  },
};

/** One step, and it is a branch point: no `next`, but two ways on. */
const BRANCHING: Flow = {
  id: "f2",
  name: "Decide",
  mermaid: "",
  diagramId: "d1",
  entryStepId: "c1",
  steps: {
    c1: {
      id: "c1",
      type: "condition",
      title: "cached?",
      branches: [
        { label: "yes", nextId: "hit" },
        { label: "no", nextId: "miss" },
      ],
    } as unknown as FlowStep,
    hit: { id: "hit", type: "action", title: "serve from cache" } as FlowStep,
    miss: { id: "miss", type: "action", title: "fetch" } as FlowStep,
  },
};

function diagramWith(flows: Flow[]): Diagram {
  return {
    id: "d1",
    name: "D",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { c1: box() },
      connections: {},
      flows: Object.fromEntries(flows.map((f) => [f.id, f])),
      iconLibrary: {},
    },
    nodeLayouts: { c1: { elementId: "c1", x: 0, y: 0 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    activeSceneId: null,
  } as unknown as Diagram;
}

function open(flow: Flow, extra: { lockedToInitialFlow?: boolean; flows?: Flow[] } = {}) {
  const onReachedFlowEnd = vi.fn();
  const onReachedFlowStart = vi.fn();
  render(
    <MemoryRouter>
      <ViewerCanvas
        diagram={diagramWith(extra.flows ?? [flow])}
        showOpenInStructuraButton={false}
        initialFlowId={flow.id}
        onReachedFlowEnd={onReachedFlowEnd}
        onReachedFlowStart={onReachedFlowStart}
        lockedToInitialFlow={extra.lockedToInitialFlow}
      />
    </MemoryRouter>,
  );
  return { onReachedFlowEnd, onReachedFlowStart };
}

const forward = () => fireEvent.keyDown(window, { key: "ArrowRight" });
const back = () => fireEvent.keyDown(window, { key: "ArrowLeft" });
const stepTitle = () => screen.getByTestId("flow-step-title").textContent;

describe("the forward key", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("walks to the next step while there is one, reporting no end", () => {
    const { onReachedFlowEnd } = open(TWO_STEPS);

    forward();

    expect(stepTitle()).toContain("second");
    expect(onReachedFlowEnd).not.toHaveBeenCalled();
  });

  it("reports the end once the last step is reached", () => {
    const { onReachedFlowEnd } = open(TWO_STEPS);

    forward(); // → s2, the last step
    forward(); // → nowhere left to go

    expect(onReachedFlowEnd).toHaveBeenCalledTimes(1);
    expect(stepTitle()).toContain("second");
  });

  it("reports the end once per press, not once and then continuously", () => {
    const { onReachedFlowEnd } = open(TWO_STEPS);

    forward();
    forward();
    forward();

    expect(onReachedFlowEnd).toHaveBeenCalledTimes(2);
  });

  it("takes no branch at a branch point", () => {
    open(BRANCHING);

    forward();

    // Still on the question, not on either answer.
    expect(stepTitle()).toContain("cached?");
  });

  it("reports no end at a branch point — a choice is not an ending", () => {
    const { onReachedFlowEnd } = open(BRANCHING);

    forward();
    forward();

    expect(onReachedFlowEnd).not.toHaveBeenCalled();
  });
});

describe("the back key", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("walks back while there is history, reporting no start", () => {
    const { onReachedFlowStart } = open(TWO_STEPS);

    forward();
    back();

    expect(stepTitle()).toContain("first");
    expect(onReachedFlowStart).not.toHaveBeenCalled();
  });

  it("reports the start when there is nothing to walk back to", () => {
    const { onReachedFlowStart } = open(TWO_STEPS);

    back();

    expect(onReachedFlowStart).toHaveBeenCalledTimes(1);
  });
});

describe("keys yield to text entry", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("does not report an end while focus is in a text field", () => {
    const { onReachedFlowEnd } = open(TWO_STEPS);
    const input = document.createElement("input");
    document.body.appendChild(input);

    forward();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(onReachedFlowEnd).not.toHaveBeenCalled();
    input.remove();
  });
});

describe("moving to another flow", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("is offered when the reader is the one choosing", () => {
    open(TWO_STEPS, { flows: [TWO_STEPS, BRANCHING] });

    // A shared diagram: nothing outside it decides what is being read.
    expect(screen.getByText("Switch flow")).toBeTruthy();
  });

  it("is withheld when a host has named the flow", () => {
    open(TWO_STEPS, { flows: [TWO_STEPS, BRANCHING], lockedToInitialFlow: true });

    expect(screen.queryByText("Switch flow")).toBeNull();
  });
});
