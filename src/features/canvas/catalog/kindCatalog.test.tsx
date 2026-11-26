import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import QuickInsertPopover from "../toolbar/QuickInsertPopover";
import { CanvasBottomToolbar } from "./CanvasBottomToolbar";
import { kindCatalogFor } from "./kindCatalog";
import { registryCatalog } from "./toolbarTools";
import { useCanvasPreferencesStore } from "../preferences";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

registerBuiltInDiagramKinds();
// jsdom has no layout: the popover scrolls its active option into view.
Element.prototype.scrollIntoView ??= () => undefined;

function guided() {
  const { diagram, selectId } = createKindDiagram({
    name: `Insert ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  const d = () => useDiagramStore.getState().diagrams[diagram.id]!;
  return { d, startId: selectId! };
}

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ReactFlowProvider>{ui}</ReactFlowProvider>
    </MemoryRouter>,
  );

describe("insert surfaces follow the diagram kind", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
  });

  it("lists the kind's elements with its labels, primary first, and nothing when freehand", () => {
    const { d } = guided();
    const kind = kindCatalogFor(d(), registryCatalog())!;
    expect(kind.label).toBe("Guided");
    expect(kind.entries.map((item) => item.entry.label)).toEqual([
      "Step",
      "Decision",
      "End",
      "Start",
      "Event",
      "Subprocess",
      "Data",
      "Document",
    ]);
    expect(kind.entries.filter((i) => i.primary).map((i) => i.entry.label)).toEqual([
      "Step",
      "Decision",
      "End",
    ]);
    useDiagramStore.getState().setKindMode(d().id, "freehand");
    expect(kindCatalogFor(d(), registryCatalog())).toBeNull();
  });

  it("quick insert after a dropped connection offers the journey, not C4, and connects", () => {
    const { d, startId } = guided();
    const onInsert = vi.fn();
    wrap(
      <QuickInsertPopover
        screenPos={{ x: 10, y: 10 }}
        flowPos={{ x: 400, y: 0 }}
        sourceNodeId={startId}
        sourceName="Start"
        onInsert={onInsert}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("group", { name: "C4" })).toBeNull();
    const journey = screen.getByRole("group", { name: "Guided" });
    fireEvent.click(within(journey).getByRole("option", { name: "Decision" }));
    const reading = readGuided(d());
    const decision = [...reading.steps.values()].find((s) => s.flowShape === "diamond")!;
    expect(decision).toBeDefined();
    expect(reading.outgoing.get(startId)?.map((c) => c.targetId)).toContain(decision.id);
    expect(onInsert).toHaveBeenCalledWith(decision.id);
  });

  it("quick insert on a freehand diagram keeps the C4 section", () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`Free ${Math.random()}`, "context");
    store.openDiagram(diagram.id);
    wrap(
      <QuickInsertPopover
        screenPos={{ x: 10, y: 10 }}
        flowPos={{ x: 0, y: 0 }}
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "C4" })).toBeInTheDocument();
  });

  it("quick insert lists the last four recents, and keeps C4 whole below them", () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`Recents ${Math.random()}`, "context");
    store.openDiagram(diagram.id);
    const c4 = registryCatalog().entries.filter((entry) => entry.groupId === "c4");
    const flowchart = registryCatalog().entries.filter((entry) => entry.groupId === "flowchart");
    const recent = [c4[0]!.id, ...flowchart.slice(0, 5).map((entry) => entry.id)];
    useCanvasPreferencesStore.setState({ recentCatalogEntryIds: recent });
    wrap(
      <QuickInsertPopover
        screenPos={{ x: 10, y: 10 }}
        flowPos={{ x: 0, y: 0 }}
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const recents = screen.getByRole("group", { name: "Recent" });
    expect(within(recents).getAllByRole("option")).toHaveLength(4);
    const top = screen.getByRole("group", { name: "C4" });
    expect(within(top).getAllByRole("option")).toHaveLength(c4.length);
    useCanvasPreferencesStore.setState({ recentCatalogEntryIds: [] });
  });

  it("the bottom toolbar offers Step, Decision, End and More instead of C4 and Flowchart", () => {
    guided();
    const props = {
      diagram: { versions: [], activeVersionId: null },
      isPanelOpen: false,
      canInsert: true,
      onInserted: vi.fn(),
      arrange: { onArrange: vi.fn() } as never,
      versions: { locked: false, open: false, onOpenChange: vi.fn() },
      tags: {
        allTags: [],
        visibleTags: null,
        locked: false,
        onToggle: vi.fn(),
        onShowAll: vi.fn(),
        onShowNoTags: vi.fn(),
      },
    } as unknown as Parameters<typeof CanvasBottomToolbar>[0];
    const { unmount } = wrap(<CanvasBottomToolbar {...props} />);
    for (const label of ["Step", "Decision", "End"])
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More elements of this kind" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Insert a C4 element/ })).toBeNull();
    unmount();

    const store = useDiagramStore.getState();
    const free = store.addDiagram(`Free ${Math.random()}`, "context");
    store.openDiagram(free.id);
    wrap(<CanvasBottomToolbar {...props} />);
    expect(screen.getByRole("button", { name: /Insert a C4 element/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decision" })).toBeNull();
  });
});
