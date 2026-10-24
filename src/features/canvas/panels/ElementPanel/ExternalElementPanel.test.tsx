import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import type { ExternalElementComponent } from "@/features/diagram";
import ExternalElementPanel from "./ExternalElementPanel";

vi.mock("@/features/collaboration", () => ({ useCollab: () => ({ isGuest: false }) }));
vi.mock("@/features/collaboration/hooks/useElementLocks", () => ({
  useElementTextLock: () => ({ onFocus: () => undefined, onBlur: () => undefined, lockedBy: null }),
}));

/**
 * The panel once wrote `linkedDiagramId`; the node, the export and navigation read
 * `referenceDiagramId`. Choosing a target diagram changed a field nobody read.
 */
describe("ExternalElementPanel target diagram", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("writes the field the node reads", () => {
    const store = useDiagramStore.getState();
    const here = store.addDiagram("Here", "context");
    const target = store.addDiagram("Target - imported 01/01/2026", "container");
    store.openDiagram(here.id);
    const external = store.addComponent("external-element", "Target", null, { x: 0, y: 0 });
    const updateComponent = useDiagramStore.getState().updateComponent;

    const current = () =>
      useDiagramStore.getState().diagrams[here.id].snapshot.components[
        external.id
      ] as ExternalElementComponent;

    render(
      <MemoryRouter>
        <ReactFlowProvider>
          <ExternalElementPanel
            component={current()}
            onClose={vi.fn()}
            updateComponent={updateComponent}
            removeComponent={vi.fn()}
          />
        </ReactFlowProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Link a diagram/ }));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(current().referenceDiagramId).toBe(target.id);
    // The denormalised name carries no import stamp either.
    expect(current().linkedDiagramName).toBe("Target");
    expect(current().linkedDiagramId).toBeUndefined();
  });
});
