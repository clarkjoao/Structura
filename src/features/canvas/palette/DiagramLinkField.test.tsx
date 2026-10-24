import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { DiagramLinkField } from "./DiagramLinkField";

vi.mock("@/features/collaboration", () => ({ useCollab: () => ({ isGuest: false }) }));

function seed() {
  const store = useDiagramStore.getState();
  const here = store.addDiagram("Here", "context");
  const checkout = store.addDiagram("Checkout - imported 24/10/2026", "container");
  const billing = store.addDiagram("Billing", "container");
  store.openDiagram(here.id);
  return { here, checkout, billing };
}

function renderField(props: Partial<Parameters<typeof DiagramLinkField>[0]> = {}) {
  const onLink = vi.fn();
  const onCreateAndLink = vi.fn();
  render(
    <MemoryRouter>
      <DiagramLinkField
        componentId="el"
        label="Linked diagram"
        elementName="Checkout"
        linkedDiagramId={undefined}
        canCreate
        onLink={onLink}
        onCreateAndLink={onCreateAndLink}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onLink, onCreateAndLink };
}

describe("DiagramLinkField", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    // The store is global: start each test from an empty workspace.
    useDiagramStore.setState({ diagrams: {}, folders: {}, activeDiagramId: null });
  });

  it("is a trigger, not a list: no 'None' entry, nothing to unlink while unlinked", () => {
    seed();
    renderField();
    expect(screen.getByRole("button", { name: /Link a diagram/ })).toBeTruthy();
    expect(screen.queryByText("None")).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull();
  });

  it("shows the current link by its name, without the import stamp, and unlinks", () => {
    const { checkout } = seed();
    const { onLink } = renderField({ linkedDiagramId: checkout.id });
    expect(screen.getByRole("button", { name: /Checkout/ })).toBeTruthy();
    expect(screen.queryByText(/imported 24/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onLink).toHaveBeenCalledWith(undefined);
  });

  it("opens the palette with the context line, the same-name suggestion and create", () => {
    seed();
    renderField();
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    expect(screen.getByText("Link diagram to Checkout")).toBeTruthy();
    expect(screen.getByText("Same name as this element")).toBeTruthy();
    expect(screen.getByText("Create “Checkout” and link")).toBeTruthy();
  });

  it("does not list the diagram the element sits in", () => {
    seed();
    renderField();
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    expect(screen.queryByTitle("Here")).toBeNull();
    expect(screen.getByTitle("Billing")).toBeTruthy();
  });

  it("↵ links the suggested diagram", () => {
    const { checkout } = seed();
    const { onLink } = renderField();
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onLink).toHaveBeenCalledWith(checkout.id);
  });

  it("the card title has no import stamp; 'Imported' is quiet metadata", () => {
    seed();
    renderField({ elementName: "Zed" });
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    const card = screen.getByTitle("Checkout");
    expect(card.textContent).toContain("Imported");
    expect(card.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("an unnamed element is suggested nothing", () => {
    seed();
    renderField({ elementName: "" });
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    expect(screen.queryByText("Same name as this element")).toBeNull();
    expect(screen.queryByText(/Create “/)).toBeNull();
  });

  it("create-and-link runs the caller's action", () => {
    seed();
    const { onCreateAndLink } = renderField({ elementName: "Brand new" });
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    fireEvent.click(screen.getByText("Create “Brand new” and link"));
    expect(onCreateAndLink).toHaveBeenCalled();
  });

  it("offers no create where the element cannot own a diagram", () => {
    seed();
    renderField({ canCreate: false });
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    expect(screen.queryByText(/Create “/)).toBeNull();
  });
});
