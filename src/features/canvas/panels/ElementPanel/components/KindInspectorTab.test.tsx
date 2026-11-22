import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import { toast } from "sonner";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { Component } from "@/features/diagram";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { kindInspectorFor } from "@/features/diagram-kinds/inspector";
import { readGuided } from "@/features/diagram-kinds/guided/guided.model";
import { KindQuickActions } from "../../../selection-actions/KindQuickActions";
import { kindMenuItemsFor } from "../../../chrome/kindElementActions";
import ComponentPanel from "../ComponentPanel";
import { KindInspectorTab } from "./KindInspectorTab";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/features/collaboration", () => ({ useCollab: () => ({ isGuest: false }) }));
vi.mock("@/features/collaboration/hooks/useElementLocks", () => ({
  useElementTextLock: () => ({ onFocus: () => undefined, onBlur: () => undefined, lockedBy: null }),
}));

registerBuiltInDiagramKinds();

// The phase select (cmdk) measures its list.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
Element.prototype.scrollIntoView ??= () => undefined;

function setup() {
  const { diagram, selectId } = createKindDiagram({
    name: `Journey ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  const d = () => useDiagramStore.getState().diagrams[diagram.id]!;
  return { d, startId: selectId!, lanes: readGuided(d()).lanes.map((l) => l.id) };
}

/** A step after the start, then a decision after it with two exits. */
function withDecision() {
  const ctx = setup();
  const run = (id: string, selected: string) => {
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    const item = kindMenuItemsFor(ctx.d(), selected, [selected]).find((i) => i.id === id)!;
    item.onSelect();
    return [...readGuided(ctx.d()).steps.keys()];
  };
  run("guided.next", ctx.startId);
  const stepId = [...readGuided(ctx.d()).steps.keys()].find((id) => id !== ctx.startId)!;
  return { ...ctx, stepId, run };
}

const renderTab = (d: () => Parameters<typeof kindInspectorFor>[0], id: string) =>
  render(<KindInspectorTab sections={kindInspectorFor(d(), id)!.sections} />);

describe("the guided Journey tab", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    vi.mocked(toast.info).mockClear();
  });

  it("is offered for a step only, and only in kind mode", () => {
    const { d, startId, lanes } = setup();
    expect(kindInspectorFor(d(), startId)?.sections.map((s) => s.id)).toEqual([
      "lane",
      "stepKind",
      "phase",
      "experience",
    ]);
    expect(kindInspectorFor(d(), lanes[0]!)).toBeNull();
    useDiagramStore.getState().setKindMode(d().id, "freehand");
    expect(kindInspectorFor(d(), startId)).toBeNull();
  });

  it("moves a step to another lane in one undo step", () => {
    const { d, startId, lanes } = setup();
    renderTab(d, startId);
    const lane = screen.getByTestId("kind-inspector-lane");
    expect(lane.querySelector("[aria-checked=true]")?.textContent).toBe("User");
    fireEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(readGuided(d()).laneOf.get(startId)).toBe(lanes[1]);
    useDiagramStore.getState().undo();
    expect(readGuided(d()).laneOf.get(startId)).toBe(lanes[0]);
  });

  it("moves a step into a new lane, and one undo removes the lane", () => {
    const { d, startId, lanes } = setup();
    renderTab(d, startId);
    fireEvent.click(screen.getByRole("button", { name: "New lane" }));
    const after = readGuided(d());
    expect(after.lanes).toHaveLength(3);
    expect(after.lanes[2]!.name).toBe("New lane");
    expect(after.laneOf.get(startId)).toBe(after.lanes[2]!.id);
    useDiagramStore.getState().undo();
    expect(readGuided(d()).lanes).toHaveLength(2);
    expect(readGuided(d()).laneOf.get(startId)).toBe(lanes[0]);
  });

  it("creates a phase from the phase select, then offers it to pick", () => {
    const { d, startId } = setup();
    const { unmount } = renderTab(d, startId);
    const field = screen.getByTestId("kind-inspector-phase");
    expect(field.textContent).toBe("No phase");
    fireEvent.click(field);
    fireEvent.change(screen.getByTestId("kind-inspector-phase-search"), {
      target: { value: "Discover" },
    });
    fireEvent.click(screen.getByTestId("kind-inspector-phase-create"));
    expect(readGuided(d()).steps.get(startId)!.kindProps?.phase).toBe("Discover");
    unmount();
    renderTab(d, startId);
    expect(screen.getByTestId("kind-inspector-phase").textContent).toBe("Discover");
    fireEvent.click(screen.getByTestId("kind-inspector-phase"));
    expect(screen.getByRole("option", { name: "Discover" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Remove the phase" }));
    expect(readGuided(d()).steps.get(startId)!.kindProps?.phase).toBeUndefined();
  });

  it("leaves a step's floating bar without the lane menu", () => {
    const { startId } = setup();
    const { container } = render(<KindQuickActions elementId={startId} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("changes the step kind, and refuses a second start", () => {
    const { d, stepId } = withDecision();
    renderTab(d, stepId);
    fireEvent.click(screen.getByRole("radio", { name: "Decision" }));
    expect(readGuided(d()).steps.get(stepId)!.flowShape).toBe("diamond");
    fireEvent.click(screen.getByRole("radio", { name: "Start" }));
    expect(readGuided(d()).steps.get(stepId)!.flowShape).toBe("diamond");
    expect(toast.info).toHaveBeenCalledWith("A guided diagram has one start step.");
  });

  it("refuses to end a step that has exits", () => {
    const { d, startId } = withDecision();
    renderTab(d, startId);
    fireEvent.click(screen.getByRole("radio", { name: "End" }));
    expect(readGuided(d()).steps.get(startId)!.flowShape).toBe("start");
    expect(toast.info).toHaveBeenCalled();
  });

  it("labels a decision's exits in one undo step", () => {
    const { d, stepId, run } = withDecision();
    run("guided.branch", stepId);
    const decision = [...readGuided(d()).steps.values()].find((s) => s.flowShape === "diamond")!;
    run("guided.branch", decision.id);
    expect(readGuided(d()).outgoing.get(decision.id)).toHaveLength(2);
    renderTab(d, decision.id);
    const fields = screen
      .getByTestId("kind-inspector-exits")
      .querySelectorAll<HTMLInputElement>("input");
    expect(fields).toHaveLength(2);
    useDiagramStore.setState({ _lastUndoRedoTimestamp: 0 });
    fireEvent.focus(fields[0]!);
    fireEvent.change(fields[0]!, { target: { value: " Approved " } });
    fireEvent.blur(fields[0]!);
    const first = readGuided(d()).outgoing.get(decision.id)![0]!;
    expect(first.label).toBe("Approved");
    useDiagramStore.getState().undo();
    expect(readGuided(d()).outgoing.get(decision.id)![0]!.label ?? "").toBe("");
  });
});

describe("the inspector in guided mode", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  const renderPanel = (component: Component) => {
    const { updateComponent, removeComponent } = useDiagramStore.getState();
    return render(
      <MemoryRouter>
        <ReactFlowProvider>
          <ComponentPanel
            component={component}
            onClose={vi.fn()}
            updateComponent={updateComponent}
            removeComponent={removeComponent}
          />
        </ReactFlowProvider>
      </MemoryRouter>,
    );
  };

  it("opens a step on Journey, and Details has no technology, type or shape", () => {
    const { d, startId } = setup();
    renderPanel(d().snapshot.components[startId]!);
    expect(screen.getByTestId("element-tab-kind")).toHaveTextContent("Journey");
    // The header names the step kind, not the element type.
    expect(screen.getByText("Start", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("Processes")).toBeNull();
    expect(screen.getByTestId("kind-inspector")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("element-tab-details"));
    expect(screen.queryByText("Technology")).toBeNull();
    expect(screen.queryByText("Shape")).toBeNull();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("has no Journey tab when the diagram is edited freehand", () => {
    const { d, startId } = setup();
    useDiagramStore.getState().setKindMode(d().id, "freehand");
    renderPanel(d().snapshot.components[startId]!);
    expect(screen.queryByTestId("element-tab-kind")).toBeNull();
    expect(screen.queryByTestId("kind-inspector")).toBeNull();
  });
});

describe("lane controls and the context menu", () => {
  it("offers lane controls in a lane's floating bar, and adds one after it", () => {
    const { d, lanes } = setup();
    render(<KindQuickActions elementId={lanes[0]!} />);
    expect(screen.getByRole("button", { name: /Move lane down|Descer raia/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove lane|Remover raia/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add lane|Adicionar raia/ }));
    expect(readGuided(d()).lanes).toHaveLength(3);
    expect(readGuided(d()).lanes[2]!.id).toBe(lanes[1]);
  });

  it("puts the kind's commands and actions in the context menu, and nothing when freehand", () => {
    const { d, startId } = setup();
    const ids = kindMenuItemsFor(d(), startId, [startId]).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["guided.next", "guided.branch"]));
    expect(ids.some((id) => id.startsWith("guided.moveTo."))).toBe(true);
    useDiagramStore.getState().setKindMode(d().id, "freehand");
    expect(kindMenuItemsFor(d(), startId, [startId])).toEqual([]);
  });
});
