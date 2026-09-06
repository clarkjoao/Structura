import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow, FlowStep } from "@/features/diagram";
import { isConditionStep, useDiagramStore } from "@/features/diagram";
import FlowReadingRail from "./FlowReadingRail";

/**
 * The reading in a column of its own. What these are about is the promotion of
 * the call to the headline, and the spine standing alone as the progress
 * indicator now that the dots and the counter are gone.
 */

interface Seeded {
  read: () => Flow;
  gatewayId: string;
  antifraudId: string;
  connectionId: string;
}

function seed(build: (ids: Seeded) => Record<string, FlowStep>, entryStepId = "s1"): Seeded {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Reading", "context");
  store.openDiagram(diagram.id);

  const gateway = useDiagramStore
    .getState()
    .addComponent("container", "API Gateway", null, { x: 0, y: 0 });
  const antifraud = useDiagramStore
    .getState()
    .addComponent("system", "Antifraude", null, { x: 320, y: 0 });
  const connection = useDiagramStore
    .getState()
    .addConnection(gateway.id, antifraud.id, "POST /v2/score");

  const flow = useDiagramStore.getState().addFlow(diagram.id, "Checkout — pedido pago", "")!;
  useDiagramStore.getState().updateFlow(flow.id, {
    description: "Do toque em pagar até o pedido gravado.",
  });

  const seeded: Seeded = {
    read: () => useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]!,
    gatewayId: gateway.id,
    antifraudId: antifraud.id,
    connectionId: connection.id,
  };

  useDiagramStore.getState().updateFlow(flow.id, { steps: build(seeded), entryStepId });
  return seeded;
}

function renderRail(
  flow: Flow,
  currentStepId: string,
  history: string[] = [],
  extra: {
    flows?: Flow[];
    onSelectFlow?: (id: string) => void;
    onGoNext?: () => void;
    onChooseBranch?: (index: number) => void;
    onExit?: () => void;
    seen?: string[];
  } = {},
) {
  const step = flow.steps[currentStepId] ?? null;
  return render(
    <FlowReadingRail
      flow={flow}
      currentStepId={currentStepId}
      currentStep={step}
      history={history}
      seen={extra.seen ?? history}
      flows={extra.flows ?? [flow]}
      onSelectFlow={extra.onSelectFlow ?? vi.fn()}
      isCondition={step ? isConditionStep(step) : false}
      canGoBack={history.length > 0}
      canGoForward={Boolean(step?.next)}
      onGoNext={extra.onGoNext ?? vi.fn()}
      onGoBack={vi.fn()}
      onChooseBranch={extra.onChooseBranch ?? vi.fn()}
      onExit={extra.onExit ?? vi.fn()}
    />,
  );
}

const CALL = (ids: Seeded): Record<string, FlowStep> => ({
  s1: {
    id: "s1",
    type: "action",
    componentId: ids.gatewayId,
    title: "Cliente abre o checkout",
    next: "s2",
  },
  s2: {
    id: "s2",
    type: "action",
    connectionId: ids.connectionId,
    title: "Consulta de risco antes de cobrar",
    note: "O gateway envia o cartão tokenizado.",
    payloadDirection: "request",
    duration: "120 ms",
  },
});

describe("the call is the headline of the step being read", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("puts the connection's label at the top of the scene", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-call")).toHaveTextContent("POST /v2/score");
  });

  it("says which way the payload runs", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-direction")).toHaveTextContent("request");
  });

  it("names the element the call lands on", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-target")).toHaveTextContent("Antifraude");
  });

  it("has no headline for a step that points at a node", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s1");

    expect(screen.queryByTestId("flow-reading-call")).not.toBeInTheDocument();
  });

  it("shows the author's title and note as the body of the scene", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent(
      "Consulta de risco antes de cobrar",
    );
    expect(screen.getByText("O gateway envia o cartão tokenizado.")).toBeInTheDocument();
  });

  it("reads the description as the body when the step carries no note", () => {
    const { read } = seed((ids) => ({
      ...CALL(ids),
      s2: { ...CALL(ids).s2!, note: undefined, description: "Chamada síncrona." },
    }));

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-note")).toHaveTextContent("Chamada síncrona.");
    expect(screen.queryByTestId("flow-reading-aside")).not.toBeInTheDocument();
  });

  it("keeps the description as an aside when the step carries both", () => {
    const { read } = seed((ids) => ({
      ...CALL(ids),
      s2: { ...CALL(ids).s2!, description: "Chamada síncrona." },
    }));

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-note")).toHaveTextContent(
      "O gateway envia o cartão tokenizado.",
    );
    expect(screen.getByTestId("flow-reading-aside")).toHaveTextContent("Chamada síncrona.");
  });

  it("shows the latency the author measured", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-duration")).toHaveTextContent("120 ms");
  });
});

describe("the script is named once, at the top, and not truncated", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("names the script being read", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s1");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Checkout — pedido pago");
  });

  it("carries the description beside the name", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s1");

    expect(screen.getByText("Do toque em pagar até o pedido gravado.")).toBeInTheDocument();
  });

  it("offers the other scripts from the header", () => {
    const { read } = seed(CALL);
    const other: Flow = {
      id: "flow-refund",
      name: "Refund",
      mermaid: "",
      diagramId: "d1",
      entryStepId: "r1",
      steps: { r1: { id: "r1", type: "action" } },
    };
    const onSelectFlow = vi.fn();

    renderRail(read(), "s1", [], { flows: [read(), other], onSelectFlow });
    fireEvent.click(screen.getByTitle("Read another script"));
    fireEvent.click(screen.getByRole("button", { name: "Refund" }));

    expect(onSelectFlow).toHaveBeenCalledWith("flow-refund");
  });

  it("offers nothing to switch to when the diagram has one script", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s1");

    expect(screen.queryByTitle("Read another script")).not.toBeInTheDocument();
  });
});

describe("the spine is the whole progress indicator", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("lists the steps already walked above the one in hand", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getByTestId("flow-reading-step")).toHaveTextContent("Cliente abre o checkout");
  });

  it("shows no counter of its own", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.queryByTestId("flow-progress")).not.toBeInTheDocument();
  });

  it("offers one way forward and one way back, not two of each", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s2", ["s1"]);

    expect(screen.getAllByRole("button", { name: /Next/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Previous/ })).toHaveLength(1);
  });

  it("walks on when the reader asks for the next step", () => {
    const { read } = seed(CALL);
    const onGoNext = vi.fn();

    renderRail(read(), "s1", [], { onGoNext });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(onGoNext).toHaveBeenCalled();
  });
});

const FORK = (ids: Seeded): Record<string, FlowStep> => ({
  s1: {
    id: "s1",
    type: "action",
    componentId: ids.gatewayId,
    title: "Cliente abre o checkout",
    next: "c",
  },
  c: {
    id: "c",
    type: "condition",
    componentId: ids.antifraudId,
    conditionLabel: "Cartão aprovado?",
    note: "A cobrança acontece aqui.",
    branches: [
      { label: "Aprovado", nextId: "a1" },
      { label: "Recusado", nextId: "b1" },
    ],
  },
  a1: { id: "a1", type: "action", title: "Grava o pedido", next: "a2" },
  a2: { id: "a2", type: "action", title: "Publica o evento" },
  b1: { id: "b1", type: "action", title: "Devolve 402" },
});

describe("a point of decision asks instead of advancing", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("asks the question the author wrote", () => {
    const { read } = seed(FORK);

    renderRail(read(), "c", ["s1"]);

    expect(screen.getByTestId("flow-step-title")).toHaveTextContent("Cartão aprovado?");
  });

  it("offers one button per branch", () => {
    const { read } = seed(FORK);

    renderRail(read(), "c", ["s1"]);

    const scene = screen.getByTestId("flow-reading-scene");
    expect(within(scene).getByRole("button", { name: /Aprovado/ })).toBeInTheDocument();
    expect(within(scene).getByRole("button", { name: /Recusado/ })).toBeInTheDocument();
  });

  it("says how far each branch goes and where it leads", () => {
    const { read } = seed(FORK);

    renderRail(read(), "c", ["s1"]);

    const scene = screen.getByTestId("flow-reading-scene");
    expect(within(scene).getByRole("button", { name: /Aprovado/ })).toHaveTextContent(
      "2 steps · Grava o pedido",
    );
  });

  it("hands back the branch the reader picked", () => {
    const { read } = seed(FORK);
    const onChooseBranch = vi.fn();

    renderRail(read(), "c", ["s1"], { onChooseBranch });
    fireEvent.click(
      within(screen.getByTestId("flow-reading-scene")).getByRole("button", { name: /Recusado/ }),
    );

    expect(onChooseBranch).toHaveBeenCalledWith(1);
  });

  it("takes the next button away, because there is no single next", () => {
    const { read } = seed(FORK);

    renderRail(read(), "c", ["s1"]);

    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.getByText("choose a branch to carry on")).toBeInTheDocument();
  });

  it("summarises the branches ahead while the choice is still ahead", () => {
    const { read } = seed(FORK);

    renderRail(read(), "s1");

    expect(screen.getByText("Aprovado · 2 steps")).toBeInTheDocument();
    expect(screen.getByText("Recusado · 1 step")).toBeInTheDocument();
  });
});

describe("the reading says why the canvas is blank at this step", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("says the scene is hiding the node, and names it", () => {
    const { read, gatewayId } = seed(CALL);
    const scene = useDiagramStore.getState().addScene("Q3 proposal");
    useDiagramStore.getState().setActiveScene(scene.id);
    useDiagramStore.getState().removeComponent(gatewayId);

    renderRail(read(), "s1");

    expect(screen.getByTestId("flow-step-element-state")).toHaveTextContent(
      "the scene “Q3 proposal” is hiding",
    );
  });

  it("says nothing at all when the node is on screen", () => {
    const { read } = seed(CALL);

    renderRail(read(), "s1");

    expect(screen.queryByTestId("flow-step-element-state")).not.toBeInTheDocument();
  });
});

/**
 * The same fork, but every way out of it happens.
 *
 * The footer used to tell every reader at a branch point to choose one, which
 * is the wrong instruction at a `par` and the only instruction there was.
 */
const THREADS = (ids: Seeded): Record<string, FlowStep> => ({
  s1: {
    id: "s1",
    type: "action",
    componentId: ids.gatewayId,
    title: "Vídeo enfileirado",
    next: "c",
  },
  c: {
    id: "c",
    type: "condition",
    conditionKind: "par",
    branches: [
      { label: "Notificações", nextId: "a1" },
      { label: "Métricas", nextId: "b1" },
    ],
  },
  a1: { id: "a1", type: "action", title: "Envia o e-mail" },
  b1: { id: "b1", type: "action", title: "Registra a métrica" },
});

describe("a fork into threads is not a fork in the road", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("asks the reader to follow a thread, not to choose one", () => {
    const { read } = seed(THREADS);

    renderRail(read(), "c", ["s1"]);

    expect(screen.getByText("follow a thread — all of them run")).toBeTruthy();
  });

  it("counts the ways out as threads running alongside each other", () => {
    const { read } = seed(THREADS);

    renderRail(read(), "s1");

    expect(screen.getByText(/2 threads in parallel/)).toBeTruthy();
  });

  it("names the block by what it is when nobody wrote it a question", () => {
    const { read } = seed(THREADS);

    renderRail(read(), "c", ["s1"]);

    expect(within(screen.getByTestId("flow-step-title")).getByText(/Parallel/)).toBeTruthy();
  });

  /**
   * The path is not the visit. Going back into the fork drops the thread from
   * `history`, so a reader who explored one and returned looked as though they
   * never had — the mark below only ever appeared in a test that built a
   * history by hand.
   */
  it("marks a thread the reader has been down and returned from", () => {
    const { read } = seed(THREADS);

    renderRail(read(), "c", ["s1"], { seen: ["s1", "c", "a1"] });

    const marks = screen.getAllByTestId("flow-reading-thread-walked");
    expect(marks).toHaveLength(1);
    expect(marks[0]!.textContent).toBe("read");
  });

  it("marks none while the reader has only reached the fork", () => {
    const { read } = seed(THREADS);

    renderRail(read(), "c", ["s1"]);

    expect(screen.queryByTestId("flow-reading-thread-walked")).toBeNull();
  });

  it("leaves a plain condition asking exactly what it asked before", () => {
    const { read } = seed(FORK);

    renderRail(read(), "c", ["s1"]);

    expect(screen.getByText("choose a branch to carry on")).toBeTruthy();
  });
});
