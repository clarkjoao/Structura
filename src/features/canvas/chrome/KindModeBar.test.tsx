import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { KindModeBar } from "./KindModeBar";

registerBuiltInDiagramKinds();

function guided() {
  const { diagram } = createKindDiagram({
    name: `Bar ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  return diagram.id;
}

function renderBar(diagramId: string, onSelectElement = vi.fn()) {
  const view = render(
    <KindModeBar
      diagram={useDiagramStore.getState().diagrams[diagramId]!}
      canEdit
      onSelectElement={onSelectElement}
    />,
  );
  const rerender = () =>
    view.rerender(
      <KindModeBar
        diagram={useDiagramStore.getState().diagrams[diagramId]!}
        canEdit
        onSelectElement={onSelectElement}
      />,
    );
  return { rerender, onSelectElement };
}

describe("KindModeBar", () => {
  beforeEach(() => useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 }));

  it("renders nothing on a freehand diagram", () => {
    const d = useDiagramStore.getState().addDiagram("Free", "context");
    const { container } = render(<KindModeBar diagram={d} canEdit onSelectElement={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("switches a guided diagram to freehand and back", () => {
    const id = guided();
    const { rerender } = renderBar(id);
    fireEvent.click(screen.getByRole("button", { name: /Edit freehand|Editar livremente/ }));
    expect(useDiagramStore.getState().diagrams[id]!.kindMode).toBe("freehand");
    rerender();
    fireEvent.click(screen.getByRole("button", { name: /Back to guided|Voltar ao guiado/ }));
    expect(useDiagramStore.getState().diagrams[id]!.kindMode).toBeUndefined();
  });

  it("lists the issues of a return that does not conform, and selects their element", () => {
    const id = guided();
    useDiagramStore.getState().setKindMode(id, "freehand");
    const outside = useDiagramStore
      .getState()
      .addComponent("system", "Outside", null, { x: 0, y: 900 });
    const { onSelectElement } = renderBar(id);
    fireEvent.click(screen.getByRole("button", { name: /Back to guided|Voltar ao guiado/ }));
    expect(useDiagramStore.getState().diagrams[id]!.kindMode).toBe("freehand");
    const list = screen.getByTestId("kind-issues");
    fireEvent.click(list.querySelector("li button")!);
    expect(onSelectElement).toHaveBeenCalledWith(outside.id);
  });

  it("says when the kind is not available, keeping the diagram editable", () => {
    const d = useDiagramStore
      .getState()
      .addDiagram("Missing", "context", undefined, null, undefined, { kind: "acme:value-stream" });
    render(<KindModeBar diagram={d} canEdit onSelectElement={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("acme:value-stream");
  });
});

describe("KindModeBar direction", () => {
  it("switches the direction through the given switch, and is locked with its reason", () => {
    const id = guided();
    const onChange = vi.fn();
    const diagram = useDiagramStore.getState().diagrams[id]!;
    const view = render(
      <KindModeBar
        diagram={diagram}
        canEdit
        onSelectElement={vi.fn()}
        direction={{ value: "LR", onChange, lockedReasonKey: null }}
      />,
    );
    const toggle = screen.getByTestId("kind-direction-toggle");
    expect(toggle).toHaveTextContent("Horizontal");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("TB");
    view.rerender(
      <KindModeBar
        diagram={diagram}
        canEdit
        onSelectElement={vi.fn()}
        direction={{
          value: "TB",
          onChange,
          lockedReasonKey: "canvasToolbar.arrange.directionLockedSession",
        }}
      />,
    );
    expect(screen.getByTestId("kind-direction-toggle")).toBeDisabled();
    expect(screen.getByTestId("kind-direction-toggle")).toHaveTextContent("Vertical");
  });
});

describe("KindModeBar present and review", () => {
  it("offers Present by phase only with phases, and the review presets", async () => {
    const { applyKindTextBuild, buildKindText } = await import("./kindTextCapture");
    const id = guided();
    const onPresent = vi.fn();
    const onReview = vi.fn();
    const bar = () => (
      <KindModeBar
        diagram={useDiagramStore.getState().diagrams[id]!}
        canEdit
        onSelectElement={vi.fn()}
        onPresent={onPresent}
        onReview={onReview}
      />
    );
    const view = render(bar());
    expect(screen.queryByTestId("kind-present")).toBeNull();
    const built = buildKindText("## Discover\nUsuário: A\n## Buy\nB");
    if (!built || !("edit" in built)) throw new Error("no build");
    applyKindTextBuild(built);
    // The canvas's kind watcher derives the phase flows; here it is done by hand.
    const { getDiagramKind } = await import("@/features/diagram-kinds/registry");
    const { kindContextFor } = await import("@/features/diagram-kinds/context");
    const d = useDiagramStore.getState().diagrams[id]!;
    const derived = getDiagramKind("guided")!.derive!(d, kindContextFor(d));
    if (derived) useDiagramStore.getState().applyKindEdit(derived, { history: false });
    view.rerender(bar());
    fireEvent.click(screen.getByTestId("kind-present"));
    expect(onPresent).toHaveBeenCalled();
    const trigger = screen.getByTestId("kind-review");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByTestId("kind-review-errorPaths"));
    expect(onReview).toHaveBeenCalledWith(expect.stringMatching(/error paths|caminhos de erro/i));
  });
});
