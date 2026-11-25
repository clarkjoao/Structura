import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { ReferencesTab } from "./ReferencesTab";

function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram(`Refs ${Math.random()}`, "container");
  store.openDiagram(diagram.id);
  const auth = store.addComponent("container", "Auth", null, { x: 600, y: 0 });
  const orders = store.addComponent("container", "Orders", null, { x: 0, y: 300 });
  store.addConnection(orders.id, auth.id, "HTTPS");
  const current = () =>
    useDiagramStore.getState().diagrams[diagram.id]!.snapshot.components[auth.id]!;
  return { auth, orders, current, diagramId: diagram.id };
}

describe("ReferencesTab", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("makes a reference beside the element and lists it; a click focuses it", () => {
    const { current, diagramId } = seed();
    const onFocus = vi.fn();
    const { rerender } = render(
      <ReferencesTab component={current()} canCreate onFocusElement={onFocus} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /New reference beside it/ }));
    rerender(<ReferencesTab component={current()} canCreate onFocusElement={onFocus} />);
    const row = screen.getByRole("button", { name: "Auth — reference 1" });
    fireEvent.click(row);
    const refId = Object.values(
      useDiagramStore.getState().diagrams[diagramId]!.snapshot.components,
    ).find((component) => component.type === "shared-ref")!.id;
    expect(onFocus).toHaveBeenCalledWith(refId);
  });

  it("lists who uses the element, with the protocol", () => {
    const { current, orders } = seed();
    const onFocus = vi.fn();
    render(<ReferencesTab component={current()} canCreate={false} onFocusElement={onFocus} />);
    expect(screen.queryByRole("button", { name: /New reference/ })).toBeNull();
    expect(screen.getByText("HTTPS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Orders/ }));
    expect(onFocus).toHaveBeenCalledWith(orders.id);
  });
});
