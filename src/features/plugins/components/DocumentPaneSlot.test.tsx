import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { registerPanelContribution, unregisterPanelContribution } from "../panel-registry";
import { DocumentPaneSlot, DocumentPaneToggles } from "./DocumentPaneSlot";
import { resetDocumentPaneForTests } from "./document-pane-state";

function Host() {
  return (
    <>
      <DocumentPaneToggles />
      <DocumentPaneSlot isEditMode />
    </>
  );
}

afterEach(() => {
  unregisterPanelContribution("test/pane");
  resetDocumentPaneForTests();
});

describe("document pane slot", () => {
  it("opens and closes a plugin pane from its toolbar toggle", () => {
    registerPanelContribution({
      id: "test/pane",
      slot: "document-pane",
      title: { en: "opscr", "pt-BR": "opscr" },
      component: () => <div>pane content</div>,
    });
    render(<Host />);
    expect(screen.queryByText("pane content")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "opscr" }));
    expect(screen.getByText("pane content")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "opscr" }));
    expect(screen.queryByText("pane content")).toBeNull();
  });

  it("contains a pane that throws", () => {
    registerPanelContribution({
      id: "test/pane",
      slot: "document-pane",
      title: "Broken",
      component: () => {
        throw new Error("boom");
      },
    });
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Broken" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
