import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useCallback } from "react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { HandleHighlightProvider } from "../../../contexts/HandleHighlightContext";
import { useCanvasHighlight } from "../../../hooks/useCanvasHighlight";
import ConnectionsTab from "./ConnectionsTab";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function seedTwoConnections() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Connections", "context");
  store.openDiagram(diagram.id);
  const a = store.addComponent("container", "A", null, { x: 0, y: 0 });
  const b = store.addComponent("container", "B", null, { x: 200, y: 0 });
  const c = store.addComponent("container", "C", null, { x: 400, y: 0 });
  const out = store.addConnection(a.id, b.id, "to-b")!;
  const inn = store.addConnection(c.id, a.id, "from-c")!;
  return { nodeId: a.id, outId: out.id, inId: inn.id };
}

function seedOneConnection() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("One", "context");
  store.openDiagram(diagram.id);
  const a = store.addComponent("container", "A", null, { x: 0, y: 0 });
  const b = store.addComponent("container", "B", null, { x: 200, y: 0 });
  store.addConnection(a.id, b.id, "only");
  return { nodeId: a.id };
}

function seedZeroConnections() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Zero", "context");
  store.openDiagram(diagram.id);
  const a = store.addComponent("container", "A", null, { x: 0, y: 0 });
  return { nodeId: a.id };
}

function seedThroughReference() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Refs", "container");
  store.openDiagram(diagram.id);
  const auth = store.addComponent("container", "Auth", null, { x: 600, y: 0 });
  const orders = store.addComponent("container", "Orders", null, { x: 0, y: 300 });
  const ref = useDiagramStore.getState().addSharedRef(auth.id, null, { x: 200, y: 300 })!;
  store.addConnection(orders.id, ref.id, "HTTPS");
  return { authId: auth.id, ordersId: orders.id, refId: ref.id };
}

function TabHarness({
  componentId,
  onHighlight,
  onClear,
  references,
  onFocusElement,
}: {
  componentId: string;
  onHighlight?: (ids: ReadonlySet<string>) => void;
  onClear?: () => void;
  references?: { canCreate: boolean };
  onFocusElement?: (id: string) => void;
}) {
  const {
    highlightedConnectionIds,
    highlightedNodeIds,
    setHighlight,
    clearHighlight: clear,
  } = useCanvasHighlight();
  onHighlight?.(highlightedConnectionIds);
  const clearHighlight = useCallback(() => {
    onClear?.();
    clear();
  }, [clear, onClear]);

  return (
    <HandleHighlightProvider
      value={{
        highlightedConnectionIds,
        highlightedNodeIds,
        setHighlight,
        clearHighlight,
      }}
    >
      <ConnectionsTab
        componentId={componentId}
        references={references}
        onFocusElement={onFocusElement}
      />
    </HandleHighlightProvider>
  );
}

describe("ConnectionsTab highlight-all default", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null } as never);
  });

  it("highlights all input and output connections on open", () => {
    const { nodeId, outId, inId } = seedTwoConnections();
    let latest = new Set<string>();

    render(
      <TabHarness
        componentId={nodeId}
        onHighlight={(ids) => {
          latest = new Set(ids);
        }}
      />,
    );

    expect([...latest].sort()).toEqual([inId, outId].sort());
  });

  it("narrows to one connection when a row is clicked", () => {
    const { nodeId, outId } = seedTwoConnections();
    let latest = new Set<string>();

    render(
      <TabHarness
        componentId={nodeId}
        onHighlight={(ids) => {
          latest = new Set(ids);
        }}
      />,
    );

    fireEvent.click(screen.getByText("to-b"));

    expect([...latest]).toEqual([outId]);
    expect(screen.getByTestId("connections-select-all")).toHaveAttribute("aria-pressed", "false");
  });

  it("Select all restores the all-highlighted state", () => {
    const { nodeId, outId, inId } = seedTwoConnections();
    let latest = new Set<string>();

    render(
      <TabHarness
        componentId={nodeId}
        onHighlight={(ids) => {
          latest = new Set(ids);
        }}
      />,
    );
    fireEvent.click(screen.getByText("to-b"));
    fireEvent.click(screen.getByTestId("connections-select-all"));

    expect([...latest].sort()).toEqual([inId, outId].sort());
    expect(screen.getByTestId("connections-select-all")).toHaveAttribute("aria-pressed", "true");
  });

  it("hides Select all when the node has only one connection", () => {
    const { nodeId } = seedOneConnection();
    render(<TabHarness componentId={nodeId} />);

    expect(screen.queryByTestId("connections-select-all")).not.toBeInTheDocument();
  });

  it("shows an empty state when the node has zero connections", () => {
    const { nodeId } = seedZeroConnections();
    render(<TabHarness componentId={nodeId} />);

    expect(screen.getByText("No connections found.")).toBeInTheDocument();
  });

  it("clears highlight on unmount", () => {
    const { nodeId } = seedTwoConnections();
    const onClear = vi.fn();
    const { unmount } = render(<TabHarness componentId={nodeId} onClear={onClear} />);
    onClear.mockClear();

    unmount();

    expect(onClear).toHaveBeenCalled();
  });

  it("marks Select all with aria-pressed when all are highlighted", () => {
    const { nodeId } = seedTwoConnections();
    render(<TabHarness componentId={nodeId} />);

    expect(screen.getByTestId("connections-select-all")).toHaveAttribute("aria-pressed", "true");
  });

  it("lists a connection that reaches a reference under incoming, marked via the reference", () => {
    const { authId, ordersId, refId } = seedThroughReference();
    const onFocus = vi.fn();
    render(
      <TabHarness componentId={authId} references={{ canCreate: true }} onFocusElement={onFocus} />,
    );
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("via reference 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to Orders" }));
    expect(onFocus).toHaveBeenCalledWith(ordersId);
    fireEvent.click(screen.getByRole("button", { name: /Auth .* reference 1/ }));
    expect(onFocus).toHaveBeenCalledWith(refId);
  });

  it("offers a new reference from the same tab, even with no connections", () => {
    const { nodeId } = seedZeroConnections();
    render(<TabHarness componentId={nodeId} references={{ canCreate: true }} />);
    expect(screen.getByTestId("connections-references")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New reference beside it/ }));
    const components = Object.values(
      useDiagramStore.getState().diagrams[useDiagramStore.getState().activeDiagramId!]!.snapshot
        .components,
    );
    expect(components.some((component) => component.type === "shared-ref")).toBe(true);
  });

  it("shows no references section where references are not offered", () => {
    const { nodeId } = seedTwoConnections();
    render(<TabHarness componentId={nodeId} />);
    expect(screen.queryByTestId("connections-references")).toBeNull();
  });
});
