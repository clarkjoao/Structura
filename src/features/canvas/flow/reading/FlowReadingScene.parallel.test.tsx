import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import FlowReadingScene from "./FlowReadingScene";
import type { ReadingBranch } from "./readingSpine";

/**
 * Threads are not a choice, and the scene has to say so.
 *
 * A `par` asks nothing: everything below it happens. Presenting its ways out
 * the way a condition's are presented — a question, `◇`, pick one — describes a
 * different flow, and the reader has no way to tell the two apart.
 */

const THREADS: readonly ReadingBranch[] = [
  { index: 0, label: "Notificações", color: "#0ea5e9", stepCount: 3, visited: false },
  { index: 1, label: "Métricas", color: "#8b5cf6", stepCount: 2, visited: false },
];

const step = (over: Partial<FlowStep> = {}): FlowStep => ({
  id: "c1",
  type: "condition",
  branches: [
    { label: "Notificações", nextId: "a1" },
    { label: "Métricas", nextId: "b1" },
  ],
  ...over,
});

function renderScene(
  over: Partial<FlowStep> = {},
  branches: readonly ReadingBranch[] = THREADS,
  readValues: { key: string; value: string; fromNumber: string }[] = [],
) {
  return render(
    <FlowReadingScene
      step={step(over)}
      call={null}
      target={null}
      heading="Vídeo enfileirado"
      isCondition
      branches={branches}
      onChooseBranch={vi.fn()}
      readValues={readValues}
    />,
  );
}

describe("a branch point whose ways out all happen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("is marked as threads rather than as a question", () => {
    renderScene({ conditionKind: "par" });

    expect(screen.getByTestId("flow-reading-branch-glyph").textContent?.trim()).toBe("⇉");
  });

  it("says outright that following one does not rule out the rest", () => {
    renderScene({ conditionKind: "par" });

    expect(screen.getByTestId("flow-reading-kind-note").textContent).toContain("ao mesmo tempo");
  });

  it("still lists every thread, so the reader can start with any of them", () => {
    renderScene({ conditionKind: "par" });

    expect(screen.getByText("Notificações")).toBeTruthy();
    expect(screen.getByText("Métricas")).toBeTruthy();
  });

  it("marks the threads the reading has already been down", () => {
    renderScene({ conditionKind: "par" }, [THREADS[0]!, { ...THREADS[1]!, visited: true }]);

    expect(screen.getAllByTestId("flow-reading-thread-walked")).toHaveLength(1);
  });

  it("never points at one thread as the way taken, because no value picks one", () => {
    renderScene({ conditionKind: "par" }, THREADS, [
      { key: "destino", value: "Notificações", fromNumber: "2" },
    ]);

    expect(screen.queryByTestId("flow-reading-branch-taken")).toBeNull();
  });
});

describe("the kinds that are a choice and something else besides", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("says a loop repeats, and marks it as the same way round again", () => {
    renderScene({ conditionKind: "loop" });

    expect(screen.getByTestId("flow-reading-branch-glyph").textContent?.trim()).toBe("↻");
    expect(screen.getByTestId("flow-reading-kind-note").textContent).toContain("se repete");
  });

  it("says an optional part may not happen", () => {
    renderScene({ conditionKind: "opt" });

    expect(screen.getByTestId("flow-reading-kind-note").textContent).toContain(
      "pode não acontecer",
    );
  });

  it("says a break ends the reading there", () => {
    renderScene({ conditionKind: "break" });

    expect(screen.getByTestId("flow-reading-kind-note").textContent).toContain("para aqui");
  });

  it("leaves the two that are only a choice with nothing extra to say", () => {
    renderScene({ conditionKind: "alt" });
    expect(screen.queryByTestId("flow-reading-kind-note")).toBeNull();

    renderScene({ conditionKind: "critical" });
    expect(screen.queryByTestId("flow-reading-kind-note")).toBeNull();
  });

  it("keeps the ordinary diamond for every kind that is not threads or a loop", () => {
    for (const kind of ["alt", "opt", "critical", "break"] as const) {
      const { unmount } = renderScene({ conditionKind: kind });
      expect(screen.getByTestId("flow-reading-branch-glyph").textContent?.trim()).toBe("◇");
      unmount();
    }
  });
});

describe("a branch point where one way out is chosen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("reads exactly as it did before the kind existed", () => {
    renderScene({ conditionLabel: "Cache hit?" });

    expect(screen.getByTestId("flow-reading-branch-glyph").textContent?.trim()).toBe("◇");
    expect(screen.queryByTestId("flow-reading-kind-note")).toBeNull();
  });

  it("marks nothing as read, since only one of its ways out will happen", () => {
    renderScene({ conditionLabel: "Cache hit?" }, [THREADS[0]!, { ...THREADS[1]!, visited: true }]);

    expect(screen.queryByTestId("flow-reading-thread-walked")).toBeNull();
  });

  it("still points at the way out a value is named after", () => {
    renderScene({ conditionLabel: "Cache hit?" }, THREADS, [
      { key: "destino", value: "Métricas", fromNumber: "2" },
    ]);

    expect(screen.getByTestId("flow-reading-branch-taken")).toBeTruthy();
  });
});
