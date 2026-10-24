import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import type { Connection } from "@/features/diagram";
import ConnectionPanel from "./ConnectionPanel";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function seed(extra: Partial<Connection> = {}) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Conn", "container");
  store.openDiagram(diagram.id);
  const a = store.addComponent("system", "Checkout", null, { x: 0, y: 0 });
  const b = store.addComponent("system", "Ledger", null, { x: 300, y: 0 });
  const conn = store.addConnection(a.id, b.id, "charges")!;
  if (Object.keys(extra).length > 0) store.updateConnection(conn.id, extra);
  const current = () =>
    useDiagramStore.getState().diagrams[diagram.id].snapshot.connections[conn.id];
  return { a, b, current };
}

function renderPanel(current: () => Connection, onFocusElement = vi.fn()) {
  const { updateConnection, removeConnection } = useDiagramStore.getState();
  render(
    <ReactFlowProvider>
      <ConnectionPanel
        conn={current()}
        onClose={vi.fn()}
        updateConnection={updateConnection}
        removeConnection={removeConnection}
        onFocusElement={onFocusElement}
      />
    </ReactFlowProvider>,
  );
  return { onFocusElement };
}

describe("ConnectionPanel semantics", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("offers interaction, type and a two-way direction; no Reverse, no transport, no Custom", () => {
    const { current } = seed();
    renderPanel(current);
    expect(screen.getByRole("radio", { name: "Synchronous" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Asynchronous" })).toBeTruthy();
    for (const kind of ["Call", "Event", "Command", "Dependency"]) {
      expect(screen.getByRole("radio", { name: kind })).toBeTruthy();
    }
    expect(screen.getByRole("radio", { name: /Unidirectional/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Bidirectional/ })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Reverse" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Custom" })).toBeNull();
    expect(screen.queryByLabelText(/transport type/i)).toBeNull();
  });

  it("choosing the interaction sets it and drops any stroke an earlier choice pinned", () => {
    const { current } = seed({
      intent: "dependency",
      style: { strokeStyle: "dashed" as never, strokeWidth: 3, animated: true, color: "#f00" },
    });
    renderPanel(current);
    fireEvent.click(screen.getByRole("radio", { name: "Asynchronous" }));
    expect(current().interaction).toBe("async");
    // Colour is the toolbar's and stays; stroke, width and animation follow the interaction now.
    expect(current().style).toEqual({ color: "#f00" });
    // The legacy intent is carried into the kind and retired.
    expect(current().kind).toBe("dependency");
    expect(current().intent).toBeUndefined();
  });

  it("choosing the type keeps the interaction", () => {
    const { current } = seed({ interaction: "async" });
    renderPanel(current);
    fireEvent.click(screen.getByRole("radio", { name: "Event" }));
    expect(current()).toMatchObject({ interaction: "async", kind: "event" });
  });

  it("the swap button turns the connection around", () => {
    const { a, b, current } = seed();
    renderPanel(current);
    fireEvent.click(screen.getByRole("button", { name: "Swap direction" }));
    expect(current()).toMatchObject({ sourceId: b.id, targetId: a.id });
  });

  it("the source and target cards navigate to their nodes", () => {
    const { a, b, current } = seed();
    const { onFocusElement } = renderPanel(current);
    fireEvent.click(screen.getByRole("button", { name: /Checkout/ }));
    expect(onFocusElement).toHaveBeenLastCalledWith(a.id);
    fireEvent.click(screen.getByRole("button", { name: /Ledger/ }));
    expect(onFocusElement).toHaveBeenLastCalledWith(b.id);
  });

  it("technology and transport is one field", () => {
    const { current } = seed();
    renderPanel(current);
    expect(screen.getAllByText("Technology and transport")).toHaveLength(1);
  });
});
