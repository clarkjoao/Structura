import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitField } from "./CommitField";
import { AdvancedFooter } from "./AdvancedFooter";
import { PanelFrame } from "./PanelFrame";
import { PanelSection } from "./PanelSection";
import { PanelHeader } from "./PanelHeader";
import {
  ELEMENT_PANEL_DEFAULT_WIDTH,
  ELEMENT_PANEL_MAX_WIDTH,
  ELEMENT_PANEL_MIN_WIDTH,
  useCanvasPreferencesStore,
} from "@/features/canvas/preferences";

// The test setup initialises i18n, so labels are real; match either locale.
const ADVANCED = /^(Advanced|Avançado)$/;
const EXPAND = /^(Expand panel|Expandir painel)$/;
const Z_INDEX = /^(Stacking order|Ordem de empilhamento)/;

describe("CommitField", () => {
  it("writes once per edit, on blur — not per keystroke", () => {
    const onCommit = vi.fn();
    render(<CommitField label="Name" value="a" onCommit={onCommit} />);
    const input = screen.getByLabelText("Name");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("abc");
  });

  it("commits on Enter", () => {
    const onCommit = vi.fn();
    render(<CommitField label="Name" value="a" onCommit={onCommit} />);
    const input = screen.getByLabelText("Name");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("x");
  });

  it("drops the draft on Escape", () => {
    const onCommit = vi.fn();
    render(<CommitField label="Name" value="a" onCommit={onCommit} />);
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("a");
  });

  it("writes nothing when the value did not change", () => {
    const onCommit = vi.fn();
    render(<CommitField label="Name" value="a" onCommit={onCommit} />);
    const input = screen.getByLabelText("Name");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits a pending draft when it unmounts under the user", () => {
    const onCommit = vi.fn();
    const { unmount } = render(<CommitField label="Name" value="a" onCommit={onCommit} />);
    const input = screen.getByLabelText("Name");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "kept" } });
    unmount();
    expect(onCommit).toHaveBeenCalledWith("kept");
  });

  it("does not overwrite a draft with a store update while focused", () => {
    const { rerender } = render(<CommitField label="Name" value="a" onCommit={vi.fn()} />);
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "typing" } });
    rerender(<CommitField label="Name" value="from-store" onCommit={vi.fn()} />);
    expect(input.value).toBe("typing");
  });

  it("shows an empty field as '+ Add …' until clicked", () => {
    render(
      <CommitField label="Technology" value="" addLabel="Add technology" onCommit={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Technology")).toBeNull();
    fireEvent.click(screen.getByText("+ Add technology"));
    expect(screen.getByLabelText("Technology")).toBeTruthy();
  });

  it("keeps Enter for a newline in a multiline field", () => {
    const onCommit = vi.fn();
    render(<CommitField label="Description" value="" multiline onCommit={onCommit} />);
    const area = screen.getByLabelText("Description");
    fireEvent.focus(area);
    fireEvent.change(area, { target: { value: "a\nb" } });
    fireEvent.keyDown(area, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(area);
    expect(onCommit).toHaveBeenCalledWith("a\nb");
  });

  it("the title variant commits on Enter and never holds a newline", () => {
    const onCommit = vi.fn();
    render(<CommitField variant="title" label="Name" value="a" onCommit={onCommit} />);
    const area = screen.getByLabelText("Name") as HTMLTextAreaElement;
    fireEvent.focus(area);
    fireEvent.change(area, { target: { value: "one\ntwo" } });
    fireEvent.keyDown(area, { key: "Enter" });
    fireEvent.blur(area);
    expect(onCommit).toHaveBeenCalledWith("one two");
  });
});

describe("AdvancedFooter", () => {
  it("is folded by default and shows the ID once opened", () => {
    render(<AdvancedFooter id="node-1" />);
    expect(screen.queryByText("node-1")).toBeNull();
    fireEvent.click(screen.getByText(ADVANCED));
    expect(screen.getByText("node-1")).toBeTruthy();
  });

  it("commits the z-index on blur", () => {
    const onCommitZIndex = vi.fn();
    render(<AdvancedFooter id="n" zIndex={2} onCommitZIndex={onCommitZIndex} />);
    fireEvent.click(screen.getByText(ADVANCED));
    const input = screen.getByLabelText(Z_INDEX);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9" } });
    expect(onCommitZIndex).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommitZIndex).toHaveBeenCalledWith(9);
  });
});

describe("PanelSection", () => {
  it("folds and unfolds its body", () => {
    render(
      <PanelSection title="What it is">
        <p>body</p>
      </PanelSection>,
    );
    expect(screen.getByText("body")).toBeTruthy();
    fireEvent.click(screen.getByText("What it is"));
    expect(screen.queryByText("body")).toBeNull();
  });
});

describe("PanelFrame", () => {
  beforeEach(() => {
    useCanvasPreferencesStore.setState({
      elementPanelWidth: ELEMENT_PANEL_DEFAULT_WIDTH,
      elementPanelCollapsed: false,
    });
  });

  it("resizes from the left edge, clamped, and remembers the width", () => {
    const { container } = render(
      <PanelFrame>
        <p>content</p>
      </PanelFrame>,
    );
    const handle = screen.getByRole("separator");
    // jsdom has no pointer capture.
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    expect((container.firstChild as HTMLElement).style.width).toBe(
      `${ELEMENT_PANEL_DEFAULT_WIDTH + 100}px`,
    );
    fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 });
    expect(useCanvasPreferencesStore.getState().elementPanelWidth).toBe(ELEMENT_PANEL_MAX_WIDTH);
  });

  it("never narrows below the minimum", () => {
    useCanvasPreferencesStore.getState().setElementPanelWidth(10);
    expect(useCanvasPreferencesStore.getState().elementPanelWidth).toBe(ELEMENT_PANEL_MIN_WIDTH);
  });

  it("folds to a rail and expands back", () => {
    act(() => useCanvasPreferencesStore.getState().setElementPanelCollapsed(true));
    render(
      <PanelFrame>
        <p>content</p>
      </PanelFrame>,
    );
    expect(screen.queryByText("content")).toBeNull();
    fireEvent.click(screen.getByLabelText(EXPAND));
    expect(screen.getByText("content")).toBeTruthy();
  });
});

describe("PanelHeader", () => {
  it("wraps a long name instead of truncating it", () => {
    const name = "domínio Vendas e Faturamento de Pedidos Corporativos";
    render(
      <PanelHeader
        icon={null}
        typeLabel="Boundary"
        name={name}
        namePlaceholder="Name"
        onCommitName={vi.fn()}
        menu={[]}
        onClose={vi.fn()}
      />,
    );
    const field = screen.getByDisplayValue(name);
    // A textarea wraps; a single-line input would clip to "domínio Vei…".
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.className).not.toMatch(/truncate|text-ellipsis/);
  });

  it("selects the parent from the trail", () => {
    const onSelect = vi.fn();
    render(
      <PanelHeader
        icon={null}
        typeLabel="System"
        name="Checkout"
        namePlaceholder="Name"
        onCommitName={vi.fn()}
        trail={[
          { id: "q", name: "Quantum Q-Checkout" },
          { id: "d", name: "Vendas" },
        ]}
        onSelectElement={onSelect}
        menu={[]}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Quantum Q-Checkout"));
    expect(onSelect).toHaveBeenCalledWith("q");
    fireEvent.click(screen.getByText("Vendas"));
    expect(onSelect).toHaveBeenCalledWith("d");
  });
});
