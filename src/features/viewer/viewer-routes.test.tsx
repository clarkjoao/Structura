import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import type { Component, Diagram, Flow, FlowStep } from "@/features/diagram";
import { ViewerCanvas } from "./components/ViewerCanvas";

/**
 * Starting a reading from the route in front of you.
 *
 * A shared diagram already offered its scripts, but only as a list along the
 * bottom — a diagram-level answer to a question the reader asks about the
 * thing they are looking at. The route knew which script implements it and
 * said nothing, because the viewer rebuilt the route's data by hand with every
 * control switched off.
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

const group = () =>
  ({
    id: "g1",
    type: "api-group",
    name: "api",
    parentId: null,
    serviceName: "management",
    basePath: "/api/v1",
    protocol: "REST",
  }) as unknown as Component;

const route = (id: string, path: string, handlerFlowId?: string) =>
  ({
    id,
    type: "endpoint",
    name: path,
    parentId: "g1",
    method: "POST",
    path,
    handlers: handlerFlowId ? [{ id: "h1", label: "h", flowId: handlerFlowId }] : [],
  }) as unknown as Component;

const flow = (id: string, name: string, step: Partial<FlowStep> = {}): Flow => ({
  id,
  name,
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: { s1: { id: "s1", type: "action", title: `${name} begins`, ...step } as FlowStep },
});

function diagramWith(components: Component[], flows: Flow[]): Diagram {
  return {
    id: "d1",
    name: "URLShort",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: {},
      flows: Object.fromEntries(flows.map((f) => [f.id, f])),
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    activeSceneId: null,
  } as unknown as Diagram;
}

function open(diagram: Diagram, initialFlowId: string | null = null) {
  return render(
    <MemoryRouter>
      <ViewerCanvas
        diagram={diagram}
        showOpenInStructuraButton={false}
        initialFlowId={initialFlowId}
      />
    </MemoryRouter>,
  );
}

const CREATE = flow("f1", "Create URL");
const REDIRECT = flow("f2", "Redirect");
const stepTitle = () => screen.getByTestId("flow-step-title").textContent;

describe("a route starts the reading it belongs to", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("offers the script its handler names", () => {
    open(diagramWith([group(), route("e1", "/urls", "f1")], [CREATE]));

    fireEvent.click(screen.getByTestId("endpoint-play"));

    expect(stepTitle()).toBe("Create URL begins");
  });

  it("offers the script whose step calls it, with no handler at all", () => {
    const calling = flow("f2", "Redirect", { endpointId: "e1" });
    open(diagramWith([group(), route("e1", "/urls")], [calling]));

    fireEvent.click(screen.getByTestId("endpoint-play"));

    expect(stepTitle()).toBe("Redirect begins");
  });

  it("offers nothing on a route nothing runs through", () => {
    open(diagramWith([group(), route("e1", "/urls")], [CREATE]));

    expect(screen.queryByTestId("endpoint-play")).not.toBeInTheDocument();
  });

  it("still offers nothing there once a reading is running", () => {
    open(diagramWith([group(), route("e1", "/urls")], [CREATE]));

    fireEvent.click(screen.getByRole("button", { name: /Create URL/ }));

    expect(screen.getByTestId("flow-reading-rail")).toBeInTheDocument();
    expect(screen.queryByTestId("endpoint-play")).not.toBeInTheDocument();
  });
});

describe("the group says what runs through it", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("names a script from each of its routes", () => {
    const diagram = diagramWith(
      [group(), route("e1", "/urls", "f1"), route("e2", "/urls/{slug}", "f2")],
      [CREATE, REDIRECT],
    );
    open(diagram);

    const strip = screen.getByTestId("api-group-scripts");

    expect(within(strip).getByText("Create URL")).toBeInTheDocument();
    expect(within(strip).getByText("Redirect")).toBeInTheDocument();
  });

  it("starts the one that is chosen", () => {
    const diagram = diagramWith(
      [group(), route("e1", "/urls", "f1"), route("e2", "/urls/{slug}", "f2")],
      [CREATE, REDIRECT],
    );
    open(diagram);

    fireEvent.click(within(screen.getByTestId("api-group-scripts")).getByText("Redirect"));

    expect(stepTitle()).toBe("Redirect begins");
  });

  it("says nothing for a group whose routes run nothing", () => {
    open(diagramWith([group(), route("e1", "/urls")], [CREATE]));

    expect(screen.queryByTestId("api-group-scripts")).not.toBeInTheDocument();
  });
});

describe("a link that names the script to open on", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("arrives with it already being read", () => {
    open(diagramWith([group(), route("e1", "/urls", "f1")], [CREATE, REDIRECT]), "f2");

    expect(stepTitle()).toBe("Redirect begins");
    expect(screen.queryByTestId("viewer-flow-invite")).not.toBeInTheDocument();
  });

  it("arrives on the diagram when it names none", () => {
    open(diagramWith([group(), route("e1", "/urls", "f1")], [CREATE]), null);

    expect(screen.queryByTestId("flow-reading-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("viewer-flow-invite")).toBeInTheDocument();
  });

  it("ignores a script the diagram does not hold", () => {
    open(diagramWith([group(), route("e1", "/urls", "f1")], [CREATE]), "deleted");

    expect(screen.queryByTestId("flow-reading-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("viewer-flow-invite")).toBeInTheDocument();
  });

  it("leaves the way out: closing it reaches the diagram's own list", () => {
    open(diagramWith([group(), route("e1", "/urls", "f1")], [CREATE, REDIRECT]), "f2");

    fireEvent.click(screen.getByRole("button", { name: /Exit flow/ }));

    expect(screen.getByTestId("viewer-flow-invite")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-reading-rail")).not.toBeInTheDocument();
  });
});
