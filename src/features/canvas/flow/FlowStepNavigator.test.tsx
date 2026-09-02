import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

function renderNav(flow: Flow, currentStepId: string) {
  const step = flow.steps[currentStepId] ?? null;
  return render(
    <FlowStepNavigator
      flow={flow}
      currentStepId={currentStepId}
      currentStep={step}
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
