import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import type { Diagram, Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useWalkthroughStore } from "../store/walkthrough.store";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import WalkthroughPlayerPage from "./WalkthroughPlayerPage";

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

/** A flow of two steps, so "the last step" is reachable in one press. */
function twoStepFlow(id: string, name: string): Flow {
  return {
    id,
    name,
    mermaid: "",
    diagramId: "d1",
    entryStepId: `${id}-s1`,
    steps: {
      [`${id}-s1`]: {
        id: `${id}-s1`,
        type: "action",
        title: `${name} first`,
        next: `${id}-s2`,
      } as FlowStep,
      [`${id}-s2`]: { id: `${id}-s2`, type: "action", title: `${name} second` } as FlowStep,
    },
  };
}

function diagram(id: string, name: string, flows: Flow[]): Diagram {
  return {
    id,
    name,
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { c1: { id: "c1", type: "container", name: "api", parentId: null } },
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

const FLOW_A = twoStepFlow("fa", "Alpha");
const FLOW_B = twoStepFlow("fb", "Beta");
const D1 = diagram("d1", "First diagram", [FLOW_A, FLOW_B]);
const D2 = diagram("d2", "Second diagram", [twoStepFlow("fc", "Gamma")]);

function presentation(steps: WalkthroughPresentation["steps"]): WalkthroughPresentation {
  return {
    id: "wt_1",
    title: "Tour",
    steps,
    createdAt: 0,
    updatedAt: 0,
  };
}

function mount(pres: WalkthroughPresentation, atStep = 0) {
  useWalkthroughStore.setState({ presentations: { [pres.id]: pres }, hydrated: true });
  useDiagramStore.setState({ diagrams: { d1: D1, d2: D2 } } as never);

  return render(
    <MemoryRouter initialEntries={[`/workflow/${pres.id}/step/${atStep}`]}>
      <Routes>
        <Route path="/workflow/:id/step/:step" element={<WalkthroughPlayerPage />} />
        <Route path="/workflows" element={<div data-testid="library">library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const forward = () => fireEvent.keyDown(window, { key: "ArrowRight" });
const back = () => fireEvent.keyDown(window, { key: "ArrowLeft" });
const escape = () => fireEvent.keyDown(window, { key: "Escape" });
const skipForward = () => fireEvent.keyDown(window, { key: "ArrowRight", metaKey: true });

const boundary = () => screen.queryByTestId("scene-boundary");
const stepTitle = () => screen.getByTestId("flow-step-title").textContent;

const TWO_SCENES = presentation([
  { diagramId: "d1", flowId: "fa" },
  { diagramId: "d1", flowId: "fb" },
]);

describe("one key walks the whole walkthrough", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("walks the steps of a scene without raising the boundary", () => {
    mount(TWO_SCENES);

    forward();

    expect(stepTitle()).toContain("Alpha second");
    expect(boundary()).toBeNull();
  });

  it("raises the boundary at the end of the scene's flow", () => {
    mount(TWO_SCENES);

    forward(); // → last step of scene 1
    forward(); // → nowhere left to go

    expect(boundary()).not.toBeNull();
  });

  it("crosses into the next scene on the following press, at its own first step", () => {
    mount(TWO_SCENES);

    forward();
    forward(); // boundary
    forward(); // cross

    expect(boundary()).toBeNull();
    expect(stepTitle()).toContain("Beta first");
  });
});

describe("the boundary", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("says which scene ended and names the next one", () => {
    mount(TWO_SCENES);

    forward();
    forward();

    expect(screen.getByText("Scene 1 of 2")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("leaves the reader where they were when dismissed", () => {
    mount(TWO_SCENES);

    forward();
    forward();
    escape();

    expect(boundary()).toBeNull();
    expect(stepTitle()).toContain("Alpha second");
  });

  it("reports the end of the walkthrough on the last scene, naming no next", () => {
    mount(TWO_SCENES, 1);

    forward();
    forward();

    expect(screen.getByText("End of walkthrough")).toBeTruthy();
    expect(screen.queryByText("Up next:")).toBeNull();
  });

  it("returns to the library by routing, not by loading the document", () => {
    mount(TWO_SCENES, 1);

    forward();
    forward();
    fireEvent.click(screen.getByText("Back to Library"));

    // The library route rendered in place — a document load would have blown
    // the whole tree away, along with the connected folder handle.
    expect(screen.getByTestId("library")).toBeTruthy();
  });

  it("goes back a scene from the boundary", () => {
    mount(TWO_SCENES, 1);

    forward();
    forward();
    back();

    expect(stepTitle()).toContain("Alpha first");
  });
});

describe("back at the start of a scene", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reaches into the scene before it", () => {
    mount(TWO_SCENES, 1);

    back();

    expect(stepTitle()).toContain("Alpha first");
  });

  it("does nothing on the first scene", () => {
    mount(TWO_SCENES, 0);

    back();

    expect(stepTitle()).toContain("Alpha first");
  });
});

describe("skipping a whole scene", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("jumps from mid-flow to the next scene's first step", () => {
    mount(TWO_SCENES);

    forward(); // mid-flow, deliberately not at the end
    skipForward();

    expect(stepTitle()).toContain("Beta first");
  });

  it("names the shortcut in the footer instead of leaving it to be guessed", () => {
    mount(TWO_SCENES);

    expect(screen.getByText(/skips a scene/)).toBeTruthy();
  });
});

describe("crossing into another diagram", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces the change, naming the diagram now being read", () => {
    const across = presentation([
      { diagramId: "d1", flowId: "fa" },
      { diagramId: "d2", flowId: "fc" },
    ]);
    mount(across);

    skipForward();

    // The header badge also carries the diagram's name; the announcement is
    // the one that has to say it.
    expect(
      within(screen.getByTestId("diagram-change-notice")).getByText("Second diagram"),
    ).toBeTruthy();
  });

  it("does not update a departed player when the notice outlives it", () => {
    const across = presentation([
      { diagramId: "d1", flowId: "fa" },
      { diagramId: "d2", flowId: "fc" },
    ]);
    const { unmount } = mount(across);
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));

    skipForward();
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(errors).toEqual([]);
    spy.mockRestore();
  });
});

describe("the scene's note", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  const WITH_NOTE = presentation([
    { diagramId: "d1", flowId: "fa", note: "Mention the retry budget here" },
    { diagramId: "d1", flowId: "fb" },
    { diagramId: "d1", flowId: "fa", note: "And the settlement window" },
  ]);

  it("is shown to the reader while the scene plays", () => {
    mount(WITH_NOTE);

    expect(screen.getByText("Mention the retry budget here")).toBeTruthy();
  });

  it("is absent on a scene that carries none", () => {
    mount(WITH_NOTE, 1);

    expect(screen.queryByTestId("scene-note")).toBeNull();
  });

  it("can be dismissed", () => {
    mount(WITH_NOTE);

    fireEvent.click(screen.getByLabelText("Hide note"));

    expect(screen.queryByTestId("scene-note")).toBeNull();
  });

  it("comes back on the next scene that has one", () => {
    mount(WITH_NOTE);
    fireEvent.click(screen.getByLabelText("Hide note"));

    skipForward(); // scene 2, no note
    skipForward(); // scene 3, its own note

    // Dismissing is "I have read this one", not a standing preference.
    expect(screen.getByText("And the settlement window")).toBeTruthy();
  });
});

describe("the reading stays on the scene's flow", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("offers no way to switch to another flow", () => {
    // The diagram has two flows, so the rail would normally offer the switch.
    mount(TWO_SCENES);

    // Swapping underneath the player would leave it tracking a reading nobody
    // is on, and the substituted flow's end would report a scene ending.
    expect(screen.queryByText("Switch flow")).toBeNull();
  });
});
