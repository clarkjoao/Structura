import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { FlowScriptList } from "./FlowScriptList";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * The order the fields are asked in, pinned.
 *
 * A form's order is the only part of it nothing else asserts, so it drifts:
 * the direction — what makes the step a call going out or the answer coming
 * back, and what decides whether "expects back" exists at all — had ended up
 * asked third and unnamed, with `async` sitting between the two bodies.
 */
function seedCall(step: Partial<FlowStep> = {}) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Order", "context");
  store.openDiagram(diagram.id);
  const from = useDiagramStore.getState().addComponent("system", "Web", null, { x: 0, y: 0 });
  const to = useDiagramStore.getState().addComponent("system", "API", null, { x: 200, y: 0 });
  const connection = useDiagramStore.getState().addConnection(from.id, to.id, "REST");
  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", connectionId: connection!.id, ...step },
  };
  useDiagramStore.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });
  const read = (): Flow =>
    useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]!;
  return { read };
}

function openTheStep(read: () => Flow) {
  function Harness() {
    const flow = useDiagramStore(
      (state) =>
        state.diagrams[state.activeDiagramId!]!.snapshot.flows[read().id] as Flow | undefined,
    );
    if (!flow) return null;
    return <FlowScriptList flow={flow} />;
  }
  const view = render(<Harness />);
  fireEvent.click(screen.getByText("→ REST"));
  return view;
}

/** The labels above the fields, in the order they appear on screen. */
function labelsInOrder(container: HTMLElement, wanted: string[]): string[] {
  const seen: string[] = [];
  for (const node of container.querySelectorAll("span, label")) {
    const text = node.textContent?.trim() ?? "";
    if (wanted.includes(text) && !seen.includes(text)) seen.push(text);
  }
  return seen;
}

describe("the order a call is asked in", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("asks the direction first, and async last", () => {
    const { read } = seedCall();
    const { container } = openTheStep(read);

    expect(
      labelsInOrder(container, ["Direction", "Route", "Body", "Expects back", "async"]),
    ).toEqual(["Direction", "Route", "Body", "Expects back", "async"]);
  });

  it("names the question the two buttons answer", () => {
    const { read } = seedCall();
    openTheStep(read);

    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getByText("→ Request")).toBeInTheDocument();
    expect(screen.getByText("← Response")).toBeInTheDocument();
  });

  it("drops the shape expected back when the step is the answer", () => {
    const { read } = seedCall({ payloadDirection: "response" });
    const { container } = openTheStep(read);

    expect(screen.queryByTestId("step-context-expects")).not.toBeInTheDocument();
    expect(labelsInOrder(container, ["Direction", "Route", "Body", "async"])).toEqual([
      "Direction",
      "Route",
      "Body",
      "async",
    ]);
  });

  it("leaves the step's own prose in the order the reading renders it", () => {
    const { read } = seedCall();
    const { container } = openTheStep(read);

    expect(labelsInOrder(container, ["Title", "Note", "Description", "Duration"])).toEqual([
      "Title",
      "Note",
      "Description",
      "Duration",
    ]);
  });

  it("still sets the direction from the buttons", () => {
    const { read } = seedCall();
    openTheStep(read);

    fireEvent.click(screen.getByText("← Response"));

    expect(read().steps.s1!.payloadDirection).toBe("response");
  });

  it("keeps the two bodies next to each other", () => {
    const { read } = seedCall();
    const { container } = openTheStep(read);

    const body = screen.getByTestId("step-payload");
    const expects = screen.getByTestId("step-context-expects");
    const async = within(container).getByText("async");

    expect(body.compareDocumentPosition(expects) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(expects.compareDocumentPosition(async) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
