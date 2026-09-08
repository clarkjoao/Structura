import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { Flow } from "@/features/diagram";
import { parseMermaidSequence, useDiagramStore } from "@/features/diagram";
import FlowReadingRail from "./FlowReadingRail";
import { useFlowModePlayback } from "../useFlowModePlayback";
import type { FlowMode } from "../flowMode.types";

/**
 * One reading, from Mermaid text to what the rail actually says.
 *
 * Every test around this one builds its own props. That is why they were all
 * green while the feature was broken in four separate ways: a call landing at
 * the component that made it rather than the one it reached, a recorded script
 * that never paired, a thread mark that never appeared because `goBack` erases
 * the path it was derived from, and controls wired to nothing. Each was found
 * by hand in the running editor.
 *
 * So this one builds nothing. The script comes out of the real importer and
 * through the real store action; the reading is driven by `useFlowModePlayback`
 * and the rail gets every prop from it, the way the workspace does. What it
 * asserts is only what a reader sees.
 */

const CHECKOUT = [
  "sequenceDiagram",
  "participant Cliente",
  "participant API",
  "participant Pagamentos",
  "participant Antifraude",
  "participant Email",
  "participant Metricas",
  "Cliente->>API: POST /checkout",
  "API->>Pagamentos: cobrar(pedido)",
  "Pagamentos->>Antifraude: POST /score",
  "Antifraude-->>Pagamentos: score",
  "Pagamentos-->>API: pago",
  "par Notificações",
  "  API->>Email: envia",
  "and Métricas",
  "  API->>Metricas: registra",
  "end",
  "API-->>Cliente: 201 Created",
].join("\n");

/** Imports the script the way the flow panel does, and hands back the store's copy. */
function importIntoStore(text: string): () => Flow {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Checkout", "context");
  store.openDiagram(diagram.id);

  const plan = parseMermaidSequence(text, {}, {}, { x: 0, y: 0 });
  expect(plan.errors).toEqual([]);
  expect(plan.entryStepId).toBeTruthy();

  const flowId = useDiagramStore
    .getState()
    .importMermaidSequenceResult(
      plan.newComponents,
      plan.newConnections,
      plan.steps,
      plan.entryStepId,
      "Checkout",
      plan.layouts,
    );

  return () => useDiagramStore.getState().diagrams[diagram.id]!.snapshot.flows[flowId]!;
}

/**
 * The workspace's wiring and nothing else: every value the rail gets is derived
 * from the playback slice, so a control connected to nothing fails here.
 */
function Reading({ flow }: { flow: Flow }) {
  const [mode, setMode] = useState<FlowMode>({ kind: "idle" });
  const playback = useFlowModePlayback(mode, setMode);
  const { play } = playback;

  useEffect(() => {
    play(flow);
  }, [play, flow]);

  if (mode.kind !== "playing") return null;

  return (
    <FlowReadingRail
      flow={mode.flow}
      currentStepId={mode.currentStepId}
      currentStep={playback.currentStep}
      history={mode.history}
      seen={mode.seen}
      flows={[mode.flow]}
      onSelectFlow={vi.fn()}
      isCondition={playback.isCondition}
      canGoBack={playback.canGoBack}
      canGoForward={playback.canGoForward}
      onGoNext={playback.goNext}
      onGoBack={playback.goBack}
      onChooseBranch={playback.chooseBranch}
      onExit={playback.exitPlay}
      callStack={playback.callStack}
      canStepOver={playback.stepOverTarget !== null}
      onStepOver={playback.stepOver}
      stepOutFrameId={playback.stepOutFrameId}
      onStepOut={playback.stepOut}
    />
  );
}

const scene = () => screen.getByTestId("flow-reading-scene");
/** The edge label, which is what the reading makes the headline of a call. */
const call = () => within(scene()).getByTestId("flow-reading-call").textContent ?? "";
const target = () => within(scene()).getByTestId("flow-reading-target").textContent ?? "";
const heading = () => screen.getByTestId("flow-step-title").textContent ?? "";
const trail = () =>
  within(scene())
    .queryAllByTestId("flow-reading-stack-frame")
    .map((node) => node.textContent);
const next = () => fireEvent.click(screen.getByRole("button", { name: /Next/i }));
const back = () => fireEvent.click(screen.getByRole("button", { name: /Previous/i }));

function readCheckout() {
  const read = importIntoStore(CHECKOUT);
  render(<Reading flow={read()} />);
  return read;
}

describe("reading an imported script, end to end", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("opens on the first message of the script", () => {
    readCheckout();

    expect(call()).toBe("POST /checkout");
  });

  it("says the call landed where it arrived, not where it left from", () => {
    readCheckout();

    // The importer writes the *sender* into `componentId`; the connection is
    // what says where a call lands. Reading the component first said a request
    // to the API happened at the client that made it.
    expect(target()).toContain("API");
    expect(target()).not.toContain("Cliente");
  });

  it("turns the request round: the answer lands back at the caller", () => {
    readCheckout();
    next();
    next();
    next();

    expect(call()).toBe("POST /score");
    expect(target()).toContain("Pagamentos");
  });

  it("names the callers still waiting, outermost first", () => {
    readCheckout();
    next();
    next();

    expect(trail()).toEqual(["Cliente", "API", "Pagamentos"]);
  });

  it("names nobody at the top level, where no call is open around the reader", () => {
    readCheckout();

    expect(trail()).toEqual([]);
  });

  it("indents the reading by how deep the calls are", () => {
    readCheckout();
    next();
    next();

    expect(screen.getAllByTestId("flow-reading-guide").length).toBeGreaterThan(0);
  });

  it("withholds step over on a call with a fork between it and its answer", () => {
    readCheckout();

    // `POST /checkout` is answered only after the parallel block, and nobody
    // can say which thread the reader would take on the way. A landing that
    // cannot be promised is not offered.
    expect(screen.queryByTestId("flow-reading-step-over")).toBeNull();
  });

  it("skips a call's interior and lands on its answer", () => {
    readCheckout();
    next();

    fireEvent.click(screen.getByTestId("flow-reading-step-over"));

    expect(call()).toBe("cobrar(pedido)");
    expect(target()).toContain("API");
  });

  it("keeps the skipped steps, so going back retraces them one at a time", () => {
    readCheckout();
    next();
    fireEvent.click(screen.getByTestId("flow-reading-step-over"));

    back();

    expect(call()).toBe("POST /score");
    expect(target()).toContain("Pagamentos");
  });

  it("leaves the call the reader is inside", () => {
    readCheckout();
    next();
    next();

    fireEvent.click(screen.getByTestId("flow-reading-step-out"));

    expect(call()).toBe("cobrar(pedido)");
    expect(target()).toContain("API");
  });
});

describe("reading the parallel block of an imported script", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  /** Walks to the `par`, which sits after the five messages of the round trip. */
  function walkToThreads() {
    readCheckout();
    for (let step = 0; step < 5; step += 1) next();
  }

  it("reaches a branch point the import gave no question", () => {
    walkToThreads();

    expect(heading()).toContain("Parallel");
    expect(within(scene()).getByTestId("flow-reading-kind-note").textContent).toContain(
      "at the same time",
    );
  });

  it("asks the reader to follow a thread rather than choose one", () => {
    walkToThreads();

    expect(screen.getByText("follow a thread — all of them run")).toBeTruthy();
  });

  it("marks a thread the reader went down and came back from", () => {
    walkToThreads();
    expect(screen.queryByTestId("flow-reading-thread-walked")).toBeNull();

    fireEvent.click(screen.getByText("Notificações"));
    back();

    expect(screen.getAllByTestId("flow-reading-thread-walked")).toHaveLength(1);
  });

  it("draws the return nobody wrote for a thread that never answers", () => {
    walkToThreads();

    fireEvent.click(screen.getByText("Notificações"));

    const returns = screen.getAllByTestId("flow-reading-return");
    expect(returns).toHaveLength(1);
    expect(returns[0]!.textContent).toContain("API");
  });
});
