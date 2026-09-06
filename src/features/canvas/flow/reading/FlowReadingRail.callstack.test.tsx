import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import {
  buildCallStack,
  buildFlowOutline,
  isConditionStep,
  useDiagramStore,
} from "@/features/diagram";
import FlowReadingRail from "./FlowReadingRail";

/**
 * What the rail draws once the calls are paired.
 *
 * The guides, the trail of callers and the two controls are all one claim: the
 * reader can see how deep they are and get out again. A script that declares no
 * directions must show none of it, which is the case asserted last.
 */

interface Seeded {
  read: () => Flow;
  clientId: string;
  apiId: string;
  paymentsId: string;
  antifraudId: string;
  /** Cliente → API. */
  c1: string;
  /** API → Pagamentos. */
  c2: string;
  /** Pagamentos → Antifraude. */
  c3: string;
}

function seed(build: (ids: Seeded) => Record<string, FlowStep>, entryStepId = "s1"): Seeded {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Stack", "context");
  store.openDiagram(diagram.id);

  const add = (type: string, name: string, x: number) =>
    useDiagramStore.getState().addComponent(type as never, name, null, { x, y: 0 });

  const client = add("person", "Cliente", 0);
  const api = add("container", "API", 300);
  const payments = add("container", "Pagamentos", 600);
  const antifraud = add("system", "Antifraude", 900);

  const connect = (from: string, to: string, label: string) =>
    useDiagramStore.getState().addConnection(from, to, label);

  const c1 = connect(client.id, api.id, "POST /checkout");
  const c2 = connect(api.id, payments.id, "cobrar(pedido)");
  const c3 = connect(payments.id, antifraud.id, "POST /score");

  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout", "")!;

  const seeded: Seeded = {
    read: () => useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]!,
    clientId: client.id,
    apiId: api.id,
    paymentsId: payments.id,
    antifraudId: antifraud.id,
    c1: c1.id,
    c2: c2.id,
    c3: c3.id,
  };

  useDiagramStore.getState().updateFlow(flow.id, { steps: build(seeded), entryStepId });
  return seeded;
}

function renderRail(
  flow: Flow,
  currentStepId: string,
  history: string[] = [],
  extra: { onStepOver?: () => void; onStepOut?: () => void } = {},
) {
  const step = flow.steps[currentStepId] ?? null;
  const callStack = buildCallStack(flow, buildFlowOutline(flow));
  const info = callStack.byStep.get(currentStepId);
  const stepOutFrameId =
    info && info.callDepth > 0 ? (info.openFrameIds[info.callDepth - 1] ?? null) : null;

  return render(
    <FlowReadingRail
      flow={flow}
      currentStepId={currentStepId}
      currentStep={step}
      history={history}
      flows={[flow]}
      onSelectFlow={vi.fn()}
      isCondition={step ? isConditionStep(step) : false}
      canGoBack={history.length > 0}
      canGoForward={Boolean(step?.next)}
      onGoNext={vi.fn()}
      onGoBack={vi.fn()}
      onChooseBranch={vi.fn()}
      onExit={vi.fn()}
      callStack={callStack}
      canStepOver={Boolean(info?.opensFrameId)}
      onStepOver={extra.onStepOver ?? vi.fn()}
      stepOutFrameId={stepOutFrameId}
      onStepOut={extra.onStepOut ?? vi.fn()}
    />,
  );
}

/** s1 calls the API, s2 calls Pagamentos, s3 calls Antifraude; s5 answers s2. */
const NESTED = (ids: Seeded): Record<string, FlowStep> => ({
  s1: {
    id: "s1",
    type: "action",
    connectionId: ids.c1,
    payloadDirection: "request",
    title: "POST /checkout",
    next: "s2",
  },
  s2: {
    id: "s2",
    type: "action",
    connectionId: ids.c2,
    payloadDirection: "request",
    title: "cobrar(pedido)",
    next: "s3",
  },
  s3: {
    id: "s3",
    type: "action",
    connectionId: ids.c3,
    payloadDirection: "request",
    title: "POST /score",
    next: "s5",
  },
  // No response for c3 was ever written: the reading has to draw that return.
  s5: {
    id: "s5",
    type: "action",
    connectionId: ids.c2,
    payloadDirection: "response",
    title: "pago",
  },
});

const FLAT = (ids: Seeded): Record<string, FlowStep> => ({
  s1: { id: "s1", type: "action", componentId: ids.clientId, title: "Cola a URL", next: "s2" },
  s2: { id: "s2", type: "action", connectionId: ids.c1, title: "Gera o slug", next: "s3" },
  s3: { id: "s3", type: "action", componentId: ids.apiId, title: "Devolve o link" },
});

describe("the spine shows how deep each row sits", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("draws one guide per call open around a row", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    const rows = screen.getAllByTestId("flow-reading-step");
    // s1 at depth 0, s2 at depth 1.
    expect(rows[0]!.querySelectorAll("[data-testid='flow-reading-guide']")).toHaveLength(0);
    expect(rows[1]!.querySelectorAll("[data-testid='flow-reading-guide']")).toHaveLength(1);
  });

  it("keeps the step numbers in one column however deep the row is", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    const numbers = screen
      .getAllByTestId("flow-reading-step")
      .map((row) => row.firstElementChild!.className);

    expect(new Set(numbers).size).toBe(1);
  });
});

describe("the scene names the callers still waiting", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("lists them outermost first, ending at the one making this call", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    const frames = screen.getAllByTestId("flow-reading-stack-frame").map((el) => el.textContent);

    expect(frames).toEqual(["Cliente", "API", "Pagamentos"]);
  });

  it("shows nothing at the outermost level", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s1");

    expect(screen.queryByTestId("flow-reading-stack")).toBeNull();
  });

  it("leaves the call when a caller is chosen", () => {
    const ids = seed(NESTED);
    const onStepOut = vi.fn();
    renderRail(ids.read(), "s3", ["s1", "s2"], { onStepOut });

    fireEvent.click(screen.getAllByTestId("flow-reading-stack-frame")[1]!);

    expect(onStepOut).toHaveBeenCalled();
  });
});

describe("a call that ends without a step to say so is drawn anyway", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("names the caller it returns to and carries no step number", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    const row = screen.getByTestId("flow-reading-return");

    expect(row.textContent).toContain("volta para Pagamentos");
    expect(row.firstElementChild!.textContent).toBe("");
  });
});

describe("the footer offers only the moves that have somewhere to go", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("offers both on a step that makes a call from inside another", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    expect(screen.getByTestId("flow-reading-step-over")).toBeTruthy();
    expect(screen.getByTestId("flow-reading-step-out")).toBeTruthy();
  });

  it("names the call the step-out would leave, and the key that does it", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    const control = screen.getByTestId("flow-reading-step-out");

    // The tooltip carries the shortcut; the label stays clean for a screen reader.
    expect(control.getAttribute("title")).toBe("Sair para API · ⇧F11");
    expect(control.getAttribute("aria-label")).toBe("Sair para API");
  });

  it("announces the step-over shortcut too", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s3", ["s1", "s2"]);

    expect(screen.getByTestId("flow-reading-step-over").getAttribute("title")).toBe(
      "Pular a chamada · F10",
    );
  });

  it("offers no step-out at the outermost level", () => {
    const ids = seed(NESTED);
    renderRail(ids.read(), "s1");

    expect(screen.queryByTestId("flow-reading-step-out")).toBeNull();
  });

  it("skips the call when asked", () => {
    const ids = seed(NESTED);
    const onStepOver = vi.fn();
    renderRail(ids.read(), "s2", ["s1"], { onStepOver });

    fireEvent.click(screen.getByTestId("flow-reading-step-over"));

    expect(onStepOver).toHaveBeenCalled();
  });
});

describe("a script with no directions is the rail it always was", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("draws no guide, no trail, no return and neither control", () => {
    const ids = seed(FLAT);
    renderRail(ids.read(), "s2", ["s1"]);

    expect(screen.queryByTestId("flow-reading-guide")).toBeNull();
    expect(screen.queryByTestId("flow-reading-stack")).toBeNull();
    expect(screen.queryByTestId("flow-reading-return")).toBeNull();
    expect(screen.queryByTestId("flow-reading-step-over")).toBeNull();
    expect(screen.queryByTestId("flow-reading-step-out")).toBeNull();
  });
});
