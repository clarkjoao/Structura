import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { ExternalLinkType } from "@/features/diagram";
import { ExternalLinksSection } from "./ExternalLinksSection";

function setup(links = [] as Parameters<typeof ExternalLinksSection>[0]["links"]) {
  const onAdd = vi.fn();
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  render(
    <ExternalLinksSection
      componentId="c"
      links={links}
      onAdd={onAdd}
      onUpdate={onUpdate}
      onRemove={onRemove}
    />,
  );
  return { onAdd, onUpdate, onRemove };
}

describe("ExternalLinksSection", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("starts as a '+ Add link' button, like every empty field", () => {
    setup();
    expect(screen.getByRole("button", { name: /^\+ Add link/ })).toBeTruthy();
  });

  it("adds a link with Enter from the URL, choosing the kind by icon", () => {
    const { onAdd } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Add link/ }));
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Runbook" } });
    const url = screen.getByLabelText("URL");
    fireEvent.change(url, { target: { value: "https://wiki/x" } });
    fireEvent.click(screen.getByRole("radio", { name: "Confluence" }));
    fireEvent.keyDown(url, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith({
      label: "Runbook",
      url: "https://wiki/x",
      type: ExternalLinkType.Confluence,
    });
  });

  it("will not add without a URL", () => {
    const { onAdd } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Add link/ }));
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("URL"), { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("Escape closes the form without adding", () => {
    const { onAdd } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Add link/ }));
    fireEvent.keyDown(screen.getByLabelText("Label"), { key: "Escape" });
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("editing a link commits on blur, not per keystroke", () => {
    const { onUpdate } = setup([
      { id: "l1", label: "Docs", url: "https://a", type: ExternalLinkType.Generic },
    ]);
    fireEvent.click(screen.getByText("Docs"));
    const label = screen.getByDisplayValue("Docs");
    fireEvent.focus(label);
    fireEvent.change(label, { target: { value: "Docs v2" } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.blur(label);
    expect(onUpdate).toHaveBeenCalledWith("l1", { label: "Docs v2" });
  });
});
