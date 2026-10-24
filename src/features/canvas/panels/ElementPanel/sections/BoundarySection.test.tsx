import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore, domainColor } from "@/features/diagram";
import type { PanelComponent } from "@/features/diagram";
import { BoundarySections } from "./BoundarySection";

function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Boundaries", "container");
  store.openDiagram(diagram.id);
  const vendas = store.addComponent("panel", "Vendas", null, { x: 0, y: 0 });
  const quantum = store.addComponent("panel", "Q-Checkout", vendas.id, { x: 20, y: 20 });
  const app = store.addComponent("container", "Cart", quantum.id, { x: 10, y: 10 });
  const current = () =>
    useDiagramStore.getState().diagrams[diagram.id].snapshot.components[
      quantum.id
    ] as PanelComponent;
  return { vendas, quantum, app, current };
}

function renderSections(
  current: () => PanelComponent,
  props: { onSelect?: (id: string) => void; onToggle?: (id: string) => void } = {},
) {
  const { updateComponent } = useDiagramStore.getState();
  render(
    <BoundarySections
      component={current()}
      updateComponent={updateComponent}
      onSelectElement={props.onSelect}
      onTogglePanelCollapse={props.onToggle}
    />,
  );
}

describe("BoundarySections", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("offers Quantum, System and Network, and writes the chosen type", () => {
    const { current } = seed();
    renderSections(current);
    for (const label of ["None", "Quantum", "System", "Network"]) {
      expect(screen.getByRole("radio", { name: label })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("radio", { name: "Quantum" }));
    expect(current().boundaryType).toBe("quantum");
  });

  it("shows the domain: the group the boundary sits in", () => {
    const { current } = seed();
    renderSections(current);
    expect(screen.getByText("Vendas")).toBeTruthy();
  });

  it("shows no derived appearance until the boundary has a type", () => {
    const { current } = seed();
    renderSections(current);
    expect(screen.queryByText("Derived appearance")).toBeNull();
  });

  it("shows the derived colour, and where it came from", () => {
    const { current } = seed();
    useDiagramStore.getState().updateComponent(current().id, { boundaryType: "quantum" });
    renderSections(current);
    expect(screen.getByText("Derived appearance")).toBeTruthy();
    expect(screen.getByText(domainColor("Vendas"))).toBeTruthy();
    expect(screen.getByText("Colour from the domain “Vendas”")).toBeTruthy();
  });

  it("a picked colour stays, and can be handed back to the derivation", () => {
    const { current } = seed();
    useDiagramStore
      .getState()
      .updateComponent(current().id, { boundaryType: "system", panelColor: "#123456" });
    renderSections(current);
    expect(screen.getByText("Custom colour")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Back to derived/ }));
    expect(current().panelColor).toBeUndefined();
  });

  it("lists what the boundary holds; a click selects the child", () => {
    const { current, app } = seed();
    const onSelect = vi.fn();
    renderSections(current, { onSelect });
    fireEvent.click(screen.getByRole("button", { name: "Cart" }));
    expect(onSelect).toHaveBeenCalledWith(app.id);
  });

  it("the collapse switch runs the canvas's own toggle", () => {
    const { current, quantum } = seed();
    const onToggle = vi.fn();
    renderSections(current, { onToggle });
    fireEvent.click(screen.getByRole("switch", { name: "Collapse on canvas" }));
    expect(onToggle).toHaveBeenCalledWith(quantum.id);
  });
});
