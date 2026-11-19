import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { useCanvasPreferencesStore } from "../../../preferences";
import { VersionChangesNotice } from "./VersionChangesNotice";

function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Changes", "context");
  store.openDiagram(diagram.id);
  const api = store.addComponent("container", "api", null, { x: 0, y: 0 });
  store.updateComponent(api.id, { description: "Takes orders" });
  const version = store.addVersion("Order events");
  store.setActiveVersion(version.id);
  return api.id;
}

describe("VersionChangesNotice", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useCanvasPreferencesStore.setState({ showVersionChanges: true });
  });

  it("lists what the active Version changed, base then Version", () => {
    const id = seed();
    useDiagramStore
      .getState()
      .updateComponent(id, { description: "Publishes an event per change" });
    render(<VersionChangesNotice elementId={id} />);
    expect(screen.getByText("Changed in Order events")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Takes orders")).toBeTruthy();
    expect(screen.getByText("Publishes an event per change")).toBeTruthy();
  });

  it("shows nothing for an element the Version did not change, or with the view off", () => {
    const id = seed();
    const { container, rerender } = render(<VersionChangesNotice elementId={id} />);
    expect(container.textContent).toBe("");
    useDiagramStore.getState().updateComponent(id, { description: "Changed" });
    useCanvasPreferencesStore.setState({ showVersionChanges: false });
    rerender(<VersionChangesNotice elementId={id} />);
    expect(container.textContent).toBe("");
  });
});
