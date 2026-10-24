import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { useCanvasPreferencesStore } from "@/features/canvas/preferences";
import DiagramPanel from "./DiagramPanel";

function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Checkout", "container");
  store.openDiagram(diagram.id);
  store.updateDiagramDescription(diagram.id, "How orders are paid");
  return diagram.id;
}

const diagramOf = (id: string) => useDiagramStore.getState().diagrams[id];

describe("DiagramPanel (nothing selected)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useCanvasPreferencesStore.setState({ elementPanelCollapsed: false });
  });

  it("shows the diagram's name, level and description", () => {
    seed();
    render(<DiagramPanel />);
    expect(screen.getByDisplayValue("Checkout")).toBeTruthy();
    expect(screen.getByLabelText("Level")).toHaveProperty("value", "container");
    expect(screen.getByDisplayValue("How orders are paid")).toBeTruthy();
  });

  it("renames on blur, not per keystroke", () => {
    const id = seed();
    render(<DiagramPanel />);
    const name = screen.getByDisplayValue("Checkout");
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: "Checkout v2" } });
    expect(diagramOf(id).name).toBe("Checkout");
    fireEvent.blur(name);
    expect(diagramOf(id).name).toBe("Checkout v2");
  });

  it("changes the level", () => {
    const id = seed();
    render(<DiagramPanel />);
    fireEvent.change(screen.getByLabelText("Level"), { target: { value: "component" } });
    expect(diagramOf(id).level).toBe("component");
  });

  it("toggles the legend, writing nothing when off", () => {
    const id = seed();
    render(<DiagramPanel />);
    const toggle = screen.getByRole("switch", { name: "Show legend on canvas" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(diagramOf(id).showLegend).toBeUndefined();
    fireEvent.click(toggle);
    expect(diagramOf(id).showLegend).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "Show legend on canvas" }));
    expect(diagramOf(id).showLegend).toBeUndefined();
  });

  it("previews what the legend will say, from what the diagram uses", () => {
    const store = useDiagramStore.getState();
    const id = seed();
    const a = store.addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.addComponent("system", "B", null, { x: 300, y: 0 });
    const conn = store.addConnection(a.id, b.id, "events")!;
    store.updateConnection(conn.id, { interaction: "async" });
    render(<DiagramPanel />);
    expect(diagramOf(id).showLegend).toBeUndefined();
    expect(screen.getByText("Asynchronous")).toBeTruthy();
  });

  it("closing folds the panel to its rail", () => {
    seed();
    render(<DiagramPanel />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(true);
  });
});
