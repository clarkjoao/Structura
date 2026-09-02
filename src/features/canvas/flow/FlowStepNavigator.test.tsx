import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore, isConditionStep } from "@/features/diagram";
import FlowStepNavigator from "./FlowStepNavigator";

/**
 * The reading surface. A step used to say only which component it pointed at;
 * these are about what it says now, and about not saying anything extra when
 * the author wrote nothing.
 */

function seed(steps: Record<string, FlowStep>, entryStepId = "s1") {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Reading", "context");
  store.openDiagram(diagram.id);
  const gateway = useDiagramStore
    .getState()
    .addComponent("system", "Gateway", null, { x: 0, y: 0 });
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const resolved = Object.fromEntries(
    Object.entries(steps).map(([id, step]) => [
      id,
      step.componentId === "GATEWAY" ? { ...step, componentId: gateway.id } : step,
    ]),
  );
  useDiagramStore.getState().updateFlow(flow.id, { steps: resolved, entryStepId });
  const read = (): Flow =>
    useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]!;
  return { read, diagramId: diagram.id, gatewayId: gateway.id };
}

function renderNav(
  flow: Flow,
  currentStepId: string,
  history: string[] = [],
  extra: { flows?: Flow[]; onSelectFlow?: (id: string) => void } = {},
) {
  const step = flow.steps[currentStepId] ?? null;
  return render(
    <FlowStepNavigator
      flow={flow}
      currentStepId={currentStepId}
      currentStep={step}
      history={history}
      flows={extra.flows ?? [flow]}
      onSelectFlow={extra.onSelectFlow ?? vi.fn()}
      isCondition={step ? isConditionStep(step) : false}
      canGoBack={false}
      canGoForward={Boolean(step?.next)}
      onGoNext={vi.fn()}
      onGoBack={vi.fn()}
      onChooseBranch={vi.fn()}
      onExit={vi.fn()}
    />,
  );
}

const PLAIN: Record<string, FlowStep> = {
  s1: { id: "s1", type: "action", next: "s2", componentId: "GATEWAY" },
  s2: { id: "s2", type: "action" },
};

describe("the step's own title and note are what turn stepping into reading", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows the title the author wrote", () => {
    const { read } = seed({
      ...PLAIN,
      s1: { ...PLAIN.s1!, title: "Client asks for a short link" },
    });

    renderNav(read(), "s1");

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("Client asks for a short link");
  });

  it("shows the note the author wrote", () => {
    const { read } = seed({ ...PLAIN, s1: { ...PLAIN.s1!, note: "Only the happy path." } });

    renderNav(read(), "s1");

    expect(screen.getByText("Only the happy path.")).toBeInTheDocument();
  });

  it("shows both together, the title above the note", () => {
    const { read } = seed({
      ...PLAIN,
      s1: { ...PLAIN.s1!, title: "The ask", note: "Only the happy path." },
    });

    const { container } = renderNav(read(), "s1");

    const text = container.textContent ?? "";
    expect(text.indexOf("The ask")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("The ask")).toBeLessThan(text.indexOf("Only the happy path."));
  });

  it("says nothing extra for a script that has neither", () => {
    const { read } = seed(PLAIN);

    renderNav(read(), "s1");

    expect(screen.queryByTestId("flow-step-title")).not.toBeInTheDocument();
  });

  it("treats a title of only spaces as no title", () => {
    const { read } = seed({ ...PLAIN, s1: { ...PLAIN.s1!, title: "   " } });

    renderNav(read(), "s1");

    expect(screen.queryByTestId("flow-step-title")).not.toBeInTheDocument();
  });

  it("shows the title of the step being read, not of some other step", () => {
    const { read } = seed({
      s1: { id: "s1", type: "action", next: "s2", componentId: "GATEWAY", title: "First" },
      s2: { id: "s2", type: "action", title: "Second" },
    });

    renderNav(read(), "s2");

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("Second");
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });

  it("names the dot after the author's title rather than the component", () => {
    const { read } = seed({ ...PLAIN, s1: { ...PLAIN.s1!, title: "The ask" } });

    const { container } = renderNav(read(), "s1");

    const dotTitles = [...container.querySelectorAll("[title]")].map((n) =>
      n.getAttribute("title"),
    );
    expect(dotTitles).toContain("1. The ask");
    expect(dotTitles).not.toContain("1. Gateway");
  });

  it("falls back to the component name for a dot with no title", () => {
    const { read } = seed(PLAIN);

    const { container } = renderNav(read(), "s1");

    const dotTitles = [...container.querySelectorAll("[title]")].map((n) =>
      n.getAttribute("title"),
    );
    expect(dotTitles).toContain("1. Gateway");
  });

  it("shows a title on a condition too, above its branches", () => {
    const { read } = seed({
      s1: {
        id: "s1",
        type: "condition",
        title: "The fork",
        conditionLabel: "Authorised?",
        branches: [
          { label: "Yes", nextId: "s2" },
          { label: "No", nextId: "s2" },
        ],
      },
      s2: { id: "s2", type: "action" },
    });

    renderNav(read(), "s1");

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("The fork");
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  });
});

const FORKED: Record<string, FlowStep> = {
  s1: { id: "s1", type: "action", next: "c", componentId: "GATEWAY" },
  c: {
    id: "c",
    type: "condition",
    conditionLabel: "Authorised?",
    branches: [
      { label: "Yes", nextId: "a" },
      { label: "No", nextId: "b" },
    ],
  },
  a: { id: "a", type: "action", next: "join" },
  b: { id: "b", type: "action", next: "join" },
  join: { id: "join", type: "action" },
};

describe("the counter is about the reading, not the script", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  const progress = () => screen.getByTestId("flow-progress").textContent?.replace(/\s+/g, " ");

  it("reads exactly as before on a flow with nothing to choose", () => {
    const { read } = seed({
      s1: { id: "s1", type: "action", next: "s2", componentId: "GATEWAY" },
      s2: { id: "s2", type: "action", next: "s3" },
      s3: { id: "s3", type: "action" },
    });

    renderNav(read(), "s1");

    expect(progress()).toBe("1 / 3");
  });

  it("shows no second total when the path is the whole script", () => {
    const { read } = seed({
      s1: { id: "s1", type: "action", next: "s2", componentId: "GATEWAY" },
      s2: { id: "s2", type: "action" },
    });

    renderNav(read(), "s2", ["s1"]);

    expect(progress()).toBe("2 / 2");
  });

  it("ends a four-step reading of a five-step flow at four of four", () => {
    const { read } = seed(FORKED);

    renderNav(read(), "join", ["s1", "c", "b"]);

    expect(progress()).toBe("4 / 4 · 5");
  });

  it("does not overshoot in the middle of the branch it took", () => {
    const { read } = seed(FORKED);

    renderNav(read(), "b", ["s1", "c"]);

    expect(progress()).toBe("3 / 4 · 5");
  });

  it("marks the total as a floor while the choice is still ahead", () => {
    const { read } = seed(FORKED);

    renderNav(read(), "s1", []);

    expect(progress()).toBe("1 / 4+ · 5");
  });

  it("drops the mark once the choice is behind", () => {
    const { read } = seed(FORKED);

    renderNav(read(), "a", ["s1", "c"]);

    expect(progress()).toBe("3 / 4 · 5");
  });

  it("names the script's total for whoever hovers it", () => {
    const { read } = seed(FORKED);

    renderNav(read(), "s1", []);

    expect(screen.getByTestId("flow-progress")).toHaveAttribute("title", "5 steps in the script");
  });

  it("shows a dash rather than a zero when there is no step in hand", () => {
    const { read } = seed(PLAIN);

    renderNav(read(), "nowhere", []);

    expect(progress()).toBe("— / 2");
  });
});

describe("the reader can move to another script without leaving the reading", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  function twoFlows() {
    const { read } = seed(PLAIN);
    const other: Flow = {
      id: "flow-refund",
      name: "Refund",
      mermaid: "",
      diagramId: "d1",
      entryStepId: "r1",
      steps: { r1: { id: "r1", type: "action" } },
    };
    return { read, other };
  }

  it("offers the other scripts by name", () => {
    const { read, other } = twoFlows();
    renderNav(read(), "s1", [], { flows: [read(), other] });

    fireEvent.click(screen.getByTitle("Read another script"));

    expect(screen.getByTestId("flow-switcher")).toHaveTextContent("Refund");
    expect(screen.getByTestId("flow-switcher")).toHaveTextContent("Checkout");
  });

  it("hands back the script the reader picked", () => {
    const { read, other } = twoFlows();
    const onSelectFlow = vi.fn();
    renderNav(read(), "s1", [], { flows: [read(), other], onSelectFlow });

    fireEvent.click(screen.getByTitle("Read another script"));
    fireEvent.click(screen.getByRole("button", { name: "Refund" }));

    expect(onSelectFlow).toHaveBeenCalledWith("flow-refund");
  });

  it("closes the list once a script is picked", () => {
    const { read, other } = twoFlows();
    renderNav(read(), "s1", [], { flows: [read(), other] });

    fireEvent.click(screen.getByTitle("Read another script"));
    fireEvent.click(screen.getByRole("button", { name: "Refund" }));

    expect(screen.queryByTestId("flow-switcher")).not.toBeInTheDocument();
  });

  it("keeps the list shut until it is asked for", () => {
    const { read, other } = twoFlows();
    renderNav(read(), "s1", [], { flows: [read(), other] });

    expect(screen.queryByTestId("flow-switcher")).not.toBeInTheDocument();
  });

  it("offers nothing to switch to when the diagram has one script", () => {
    const { read } = twoFlows();
    renderNav(read(), "s1", [], { flows: [read()] });

    expect(screen.queryByTitle("Read another script")).not.toBeInTheDocument();
  });

  it("still names the script being read when there is nothing to switch to", () => {
    const { read } = twoFlows();
    renderNav(read(), "s1", [], { flows: [read()] });

    expect(screen.getByText("Checkout")).toBeInTheDocument();
  });

  it("marks which one is being read", () => {
    const { read, other } = twoFlows();
    const { container } = renderNav(read(), "s1", [], { flows: [read(), other] });

    fireEvent.click(screen.getByTitle("Read another script"));

    const rows = [...container.querySelectorAll('[data-testid="flow-switcher"] button')];
    const checked = rows.filter(
      (row) => !row.querySelector("svg")?.classList.contains("opacity-0"),
    );
    expect(checked.map((row) => row.textContent?.trim())).toEqual(["Checkout"]);
  });
});
