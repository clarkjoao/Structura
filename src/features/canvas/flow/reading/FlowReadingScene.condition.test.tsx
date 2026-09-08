import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import type { FlowStep } from "@/features/diagram";
import FlowReadingScene from "./FlowReadingScene";

/**
 * A condition stops being a question with no number.
 *
 * The value is displayed, never evaluated: the way out is marked only when a
 * branch is *named* after the answer, and a condition whose branches are named
 * something else marks none rather than guessing.
 */

const CONDITION: FlowStep = {
  id: "c1",
  type: "condition",
  conditionLabel: "Score acima de 0,8?",
  branches: [
    { label: "não · segue a cobrança", nextId: "a" },
    { label: "sim · recusa por risco", nextId: "b" },
  ],
};

const BRANCHES = [
  { index: 0, label: "não · segue a cobrança", color: "#f59e0b", stepCount: 4, visited: false },
  { index: 1, label: "sim · recusa por risco", color: "#8b5cf6", stepCount: 2, visited: false },
];

function renderScene(readValues: { key: string; value: string; fromNumber: string }[] = []) {
  return render(
    <FlowReadingScene
      step={CONDITION}
      call={null}
      target={null}
      heading="Score acima de 0,8?"
      isCondition
      branches={BRANCHES}
      onChooseBranch={vi.fn()}
      readValues={readValues}
    />,
  );
}

describe("a condition shows the value it tests", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("displays the value beside the question, with where it came from", () => {
    renderScene([{ key: "score", value: "0.12", fromNumber: "4" }]);

    const evaluated = screen.getByTestId("flow-reading-eval");

    expect(evaluated.textContent).toContain("score");
    expect(evaluated.textContent).toContain("0.12");
    expect(evaluated.textContent).toContain("passo 4");
  });

  it("marks the way out the value is named after", () => {
    renderScene([{ key: "resultado", value: "não", fromNumber: "4" }]);

    expect(screen.getByTestId("flow-reading-branch-taken")).toBeTruthy();
  });

  it("marks nothing when no branch is named after the value", () => {
    renderScene([{ key: "score", value: "0.12", fromNumber: "4" }]);

    expect(screen.queryByTestId("flow-reading-branch-taken")).toBeNull();
  });

  it("renders as it always did when the step declares nothing it reads", () => {
    renderScene();

    expect(screen.queryByTestId("flow-reading-eval")).toBeNull();
    expect(screen.queryByTestId("flow-reading-branch-taken")).toBeNull();
    expect(screen.getByTestId("flow-step-title").textContent).toContain("Score acima de 0,8?");
  });
});
