import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import FlowPanel from "./FlowPanel";
import { useFlowViewStore } from "./useFlowViewStore";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

registerBuiltInDiagramKinds();

function renderPanel() {
  return render(
    <ReactFlowProvider>
      <FlowPanel
        onClose={() => {}}
        onPlay={() => {}}
        onStartRecording={() => {}}
        onEditFlow={() => {}}
        onGetInsertPosition={() => ({ x: 0, y: 0 })}
      />
    </ReactFlowProvider>,
  );
}

function guided() {
  const { diagram } = createKindDiagram({ name: "Checkout", level: "context", kindId: "guided" });
  useDiagramStore.getState().openDiagram(diagram.id);
  return diagram.id;
}

describe("the flows panel on a guided diagram", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useFlowViewStore.setState({ scriptFlowId: null, selectedStepId: null });
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
  });

  it("shows the derived flow, marked as derived, with no record action", () => {
    guided();
    renderPanel();
    expect(screen.getAllByTestId("flow-card")).toHaveLength(1);
    expect(screen.getByTestId("flow-derived-badge").textContent).toBe("Derived from the steps");
    expect(screen.queryByRole("button", { name: /New flow/ })).toBeNull();
  });

  it("offers recording again in freehand mode, where the flow is an ordinary one", () => {
    const id = guided();
    useDiagramStore.getState().setKindMode(id, "freehand");
    renderPanel();
    expect(screen.queryByTestId("flow-derived-badge")).toBeNull();
    expect(screen.getByRole("button", { name: /New flow/ })).toBeTruthy();
  });
});
