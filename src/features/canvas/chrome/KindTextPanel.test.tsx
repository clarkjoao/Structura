import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import { getDiagramKind } from "@/features/diagram-kinds/registry";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { KindTextPanel } from "./KindTextPanel";
import { pasteKindText } from "./kindTextCapture";

registerBuiltInDiagramKinds();
const capture = getDiagramKind("guided")!.textCapture!;

function setup() {
  const { diagram, selectId } = createKindDiagram({
    name: `Text ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  useCanvasSelectionStore.getState().setSelectedNodeIds(new Set());
  const d = () => useDiagramStore.getState().diagrams[diagram.id]!;
  const names = () => [...readGuided(d()).steps.values()].map((s) => s.name);
  return { d, startId: selectId!, names };
}

describe("pasting text on a guided canvas", () => {
  beforeEach(() => useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 }));

  it("adds a valid outline of two or more steps in one undo step", () => {
    const { names } = setup();
    const before = names().length;
    expect(pasteKindText("Escolhe\nPaga\nRecebe")).toBe(true);
    expect(names()).toEqual(expect.arrayContaining(["Escolhe", "Paga", "Recebe"]));
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    useDiagramStore.getState().undo();
    expect(names()).toHaveLength(before);
  });

  it("leaves a single line, text with errors and markup to the usual paste", () => {
    const { names } = setup();
    const before = names().length;
    expect(pasteKindText("Só uma linha")).toBe(false);
    expect(pasteKindText("A\n  sim -> B")).toBe(false);
    expect(pasteKindText("<mxfile>\n<diagram>\n</mxfile>")).toBe(false);
    expect(names()).toHaveLength(before);
  });

  it("builds a fenced Mermaid swimlane block and a Mermaid journey", () => {
    const { names } = setup();
    expect(
      pasteKindText(
        "```mermaid\nswimlane-beta LR\n  subgraph Loja\n    a[Escolhe] --> b[Paga]\n  end\n```",
      ),
    ).toBe(true);
    expect(names()).toEqual(expect.arrayContaining(["Escolhe", "Paga"]));
    expect(pasteKindText("journey\n  section Casa\n  Acorda: 3: Eu\n  Café: 5: Eu")).toBe(true);
    expect(names()).toEqual(expect.arrayContaining(["Acorda", "Café"]));
  });

  it("does nothing on a guided diagram edited freehand", () => {
    const { d, names } = setup();
    useDiagramStore.getState().setKindMode(d().id, "freehand");
    const before = names().length;
    expect(pasteKindText("A\nB")).toBe(false);
    expect(names()).toHaveLength(before);
  });
});

describe("KindTextPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
  });

  const open = () => {
    render(<KindTextPanel capture={capture} disabled={false} />);
    fireEvent.click(screen.getByTestId("kind-text-open"));
    return screen.getByTestId("kind-text-input");
  };
  const type = (input: HTMLElement, value: string) => {
    fireEvent.change(input, { target: { value } });
    act(() => vi.advanceTimersByTime(200));
  };

  it("lists errors by line and disables Apply", () => {
    setup();
    const input = open();
    type(input, "A\nsim -> B");
    expect(screen.getByTestId("kind-text-errors")).toHaveTextContent(/2/);
    expect(screen.getByTestId("kind-text-apply")).toBeDisabled();
    vi.useRealTimers();
  });

  it("says what a Mermaid journey sets aside", () => {
    setup();
    const input = open();
    type(input, "journey\n  section A\n  Um: 2: Eu\n  section B\n  Dois: 4: Eu");
    expect(screen.getByTestId("kind-text-summary")).toHaveTextContent(/2.*2/);
    expect(screen.getByTestId("kind-text-summary").textContent).toMatch(/section|fase/i);
    vi.useRealTimers();
  });

  it("copies the journey in each format", async () => {
    vi.useRealTimers();
    setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<KindTextPanel capture={capture} disabled={false} />);
    fireEvent.click(screen.getByTestId("kind-text-open"));
    for (const [id, pattern] of [
      ["outline", /^[^%]/],
      ["mermaid-swimlane", /swimlane-beta/],
      ["mermaid-journey", /^journey/],
    ] as const) {
      const trigger = screen.getByTestId("kind-text-copy");
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
      fireEvent.click(await screen.findByTestId(`kind-text-copy-${id}`));
      await act(async () => {});
      expect(writeText.mock.lastCall?.[0]).toMatch(pattern);
    }
  });

  it("applies with Ctrl+Enter, clears, and selects the last step added", () => {
    const { names, d } = setup();
    const input = open();
    type(input, "API: Valida\nResponde");
    expect(screen.getByTestId("kind-text-summary")).toHaveTextContent(/2/);
    expect(screen.getByTestId("kind-text-apply")).not.toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(names()).toEqual(expect.arrayContaining(["Valida", "Responde"]));
    expect((input as HTMLTextAreaElement).value).toBe("");
    const last = [...readGuided(d()).steps.values()].find((s) => s.name === "Responde")!;
    expect(useCanvasSelectionStore.getState().selectedNodeIds).toEqual(new Set([last.id]));
    vi.useRealTimers();
  });
});
