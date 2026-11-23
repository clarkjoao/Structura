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

  /** The panel in "Insert at the selection". */
  const open = () => {
    render(<KindTextPanel capture={capture} disabled={false} />);
    fireEvent.click(screen.getByTestId("kind-text-open"));
    fireEvent.click(screen.getByTestId("kind-text-mode-insert"));
    return screen.getByTestId("kind-text-input");
  };
  /** The panel on the whole journey. */
  const openJourney = () => {
    render(<KindTextPanel capture={capture} disabled={false} />);
    fireEvent.click(screen.getByTestId("kind-text-open"));
    return screen.getByTestId("kind-text-journey") as HTMLTextAreaElement;
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
    expect(screen.getByTestId("kind-text-insert-apply")).toBeDisabled();
    vi.useRealTimers();
  });

  it("summarises a Mermaid journey like an outline", () => {
    setup();
    const input = open();
    type(input, "journey\n  section A\n  Um: 2: Eu\n  section B\n  Dois: 4: Eu");
    expect(screen.getByTestId("kind-text-summary")).toHaveTextContent(/2/);
    expect(screen.getByTestId("kind-text-insert-apply")).not.toBeDisabled();
    vi.useRealTimers();
  });

  it("copies the journey in each format", async () => {
    vi.useRealTimers();
    setup();
    pasteKindText("A\nB");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<KindTextPanel capture={capture} disabled={false} />);
    fireEvent.click(screen.getByTestId("kind-text-open"));
    for (const [id, pattern] of [
      ["outline", /^[^%]/],
      ["outline-ids", /\{#s1\}/],
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

  it("inserts with Ctrl+Enter, clears, and selects the last step added", () => {
    const { names, d } = setup();
    const input = open();
    type(input, "API: Valida\nResponde");
    expect(screen.getByTestId("kind-text-summary")).toHaveTextContent(/2/);
    expect(screen.getByTestId("kind-text-insert-apply")).not.toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(names()).toEqual(expect.arrayContaining(["Valida", "Responde"]));
    expect((input as HTMLTextAreaElement).value).toBe("");
    const last = [...readGuided(d()).steps.values()].find((s) => s.name === "Responde")!;
    expect(useCanvasSelectionStore.getState().selectedNodeIds).toEqual(new Set([last.id]));
    vi.useRealTimers();
  });

  /** A journey Start → A → B → C, written by the outline. */
  const withSteps = () => {
    const ctx = setup();
    expect(pasteKindText("Usuário: A\nB\nC")).toBe(true);
    return ctx;
  };
  const idOf = (d: () => Parameters<typeof readGuided>[0], name: string) =>
    [...readGuided(d()).steps.values()].find((s) => s.name === name)?.id;

  it("opens on the whole journey and follows the canvas while untouched", () => {
    const { d } = withSteps();
    const area = openJourney();
    expect(area.value).toMatch(/A\nB\nC\n/);
    expect(screen.getByTestId("kind-text-summary")).toHaveTextContent("No changes");
    act(() => {
      useDiagramStore.getState().applyKindEdit({ update: [{ id: idOf(d, "B")!, name: "Bê" }] });
    });
    expect(area.value).toContain("Bê");
    vi.useRealTimers();
  });

  it("reviews the changes, applies them as one undo step, and selects the first", () => {
    const { d } = withSteps();
    const area = openJourney();
    const b = idOf(d, "B")!;
    type(area, area.value.replace("\nB\n", "\nBee\n").replace("\nC\n", "\n"));
    expect(screen.getByTestId("kind-text-summary")).toHaveTextContent("+0 ~1 −1");
    fireEvent.click(screen.getByTestId("kind-text-review-toggle"));
    const rows = [...screen.getByTestId("kind-text-review").querySelectorAll("li")].map(
      (li) => li.textContent,
    );
    expect(rows).toEqual(["Remove “C”", "Rename “B” → “Bee”"]);
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    expect(idOf(d, "Bee")).toBe(b);
    expect(idOf(d, "C")).toBeUndefined();
    expect(useCanvasSelectionStore.getState().selectedNodeIds).toEqual(new Set([b]));
    expect(area.value).toContain("Bee");
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    act(() => useDiagramStore.getState().undo());
    expect(idOf(d, "B")).toBe(b);
    expect(idOf(d, "C")).toBeDefined();
    vi.useRealTimers();
  });

  it("keeps an edited text when the canvas changes, and reloads on request", () => {
    const { d } = withSteps();
    const area = openJourney();
    type(area, area.value.replace("\nB\n", "\nBravo\n"));
    act(() => {
      useDiagramStore.getState().applyKindEdit({ update: [{ id: idOf(d, "C")!, name: "Cê" }] });
    });
    expect(screen.getByTestId("kind-text-stale")).toBeInTheDocument();
    expect(area.value).toContain("Bravo");
    fireEvent.click(screen.getByTestId("kind-text-reload"));
    expect(area.value).not.toContain("Bravo");
    expect(area.value).toContain("Cê");
    expect(screen.queryByTestId("kind-text-stale")).toBeNull();
    vi.useRealTimers();
  });
});
