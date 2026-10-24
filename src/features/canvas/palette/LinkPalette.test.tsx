import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { LinkPalette, type LinkPaletteProps } from "./LinkPalette";
import type { PaletteItem } from "./palette.types";

const item = (
  id: string,
  label: string,
  groupIds: string[],
  extra: Partial<PaletteItem<string>> = {},
): PaletteItem<string> => ({
  id,
  label,
  groupIds,
  payload: id,
  ...extra,
});

const items = [
  item("a", "Checkout", ["pix"], { description: "Container" }),
  item("b", "Ledger", ["core", "imp"], { meta: "Imported" }),
  item("c", "Merchant", ["pix"]),
];
const groups = [
  { id: "pix", label: "Pix" },
  { id: "core", label: "Core" },
  { id: "imp", label: "Imported" },
];

function setup(props: Partial<LinkPaletteProps<string>> = {}) {
  const onPick = vi.fn();
  const onCreate = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LinkPalette<string>
      open
      onOpenChange={onOpenChange}
      title="Link diagram to Checkout"
      items={items}
      groups={groups}
      searchPlaceholder="Search diagrams…"
      onPick={onPick}
      onCreate={onCreate}
      {...props}
    />,
  );
  return { onPick, onCreate, onOpenChange, input: screen.getByRole("combobox") };
}

describe("LinkPalette", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("names what is being linked at the top", () => {
    setup();
    expect(screen.getByText("Link diagram to Checkout")).toBeTruthy();
  });

  it("offers All, one chip per category, and Recent only when there are recents", () => {
    setup();
    const chip = (name: RegExp) => screen.getByRole("button", { name });
    expect(chip(/^All/)).toBeTruthy();
    expect(chip(/^Pix/)).toBeTruthy();
    expect(chip(/^Core/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Recent/ })).toBeNull();
  });

  it("shows the quiet metadata beside the title, not inside it", () => {
    setup();
    const card = screen.getByTitle("Ledger");
    expect(card.textContent).toContain("Imported");
    expect(card.querySelector(".truncate")?.textContent).toBe("Ledger");
  });

  it("↵ picks the first option", () => {
    const { onPick, input, onOpenChange } = setup();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(items[0], { open: false });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("⌘↵ picks and asks to open", () => {
    const { onPick, input } = setup();
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(onPick).toHaveBeenCalledWith(items[0], { open: true });
  });

  it("arrows move the selection", () => {
    const { onPick, input } = setup();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(items[1], { open: false });
  });

  it("Tab switches category", () => {
    const { input } = setup();
    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.getByRole("button", { name: /^Pix/ }).getAttribute("aria-pressed")).toBe("true");
    // Only Pix items are listed now.
    expect(screen.queryByTitle("Ledger")).toBeNull();
    expect(screen.getByTitle("Merchant")).toBeTruthy();
  });

  it("searching narrows the cards and the first hit is picked", () => {
    const { onPick, input } = setup();
    fireEvent.change(input, { target: { value: "ledg" } });
    expect(screen.queryByTitle("Checkout")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(items[1], { open: false });
  });

  it("puts suggestions first, with the reason, and the create action beside them", () => {
    const { onPick, onCreate, input } = setup({
      suggestions: [{ item: items[2], reason: "Same name as this element" }],
      createAction: { label: "Create “Checkout” and link" },
    });
    expect(screen.getByText("Same name as this element")).toBeTruthy();
    expect(screen.getByText("Create “Checkout” and link")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(items[2], { open: false });
    // Down once more reaches the create action.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(onCreate).toHaveBeenCalledWith({ open: true });
  });

  it("hides suggestions and create while searching", () => {
    const { input } = setup({
      suggestions: [{ item: items[2], reason: "Same name" }],
      createAction: { label: "Create it" },
    });
    fireEvent.change(input, { target: { value: "mer" } });
    expect(screen.queryByText("Same name")).toBeNull();
    expect(screen.queryByText("Create it")).toBeNull();
  });

  it("marks the item already linked", () => {
    setup({ currentId: "b" });
    expect(screen.getByLabelText("Linked")).toBeTruthy();
  });

  it("says so when nothing matches", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it("lists the shortcuts in the footer", () => {
    setup();
    for (const hint of ["link", "link and open", "category", "close"]) {
      expect(screen.getByText(hint)).toBeTruthy();
    }
  });

  it("marks itself as a canvas overlay so canvas shortcuts stand down", () => {
    setup();
    expect(document.querySelector('[data-canvas-overlay="open"]')).not.toBeNull();
  });
});
