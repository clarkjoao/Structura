import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { PanelKind } from "@/features/diagram/enums";
import { isReactFlowParentPanelType } from "@/features/diagram/model/component-type-constants";

/**
 * What a container owes the canvas, pinned before `panel` and `swimlane` move
 * onto the element registry.
 *
 * Drag-parenting is the area of this repo with the most regression history, and
 * the logic is spread across the store (`setParent`, `groupNodes`), the
 * geometry helpers, and a React Flow node-type check. None of it lives in a
 * descriptor — so "migrating the descriptor cannot have broken it" is a claim
 * that needs evidence, not reading. Every case here passes unchanged against
 * `main`, which is what makes this a description of the behaviour rather than
 * of the migration.
 */
describe("dragging elements in and out of containers", () => {
  function setup() {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Test", "context");
    store.getState().openDiagram(diagram.id);
    return store;
  }

  function componentOf(store: ReturnType<typeof setup>, id: string) {
    const state = store.getState();
    return state.diagrams[state.activeDiagramId!].snapshot.components[id];
  }

  function layoutOf(store: ReturnType<typeof setup>, id: string) {
    const state = store.getState();
    return state.diagrams[state.activeDiagramId!].nodeLayouts[id];
  }

  it("takes a loose element into a panel", () => {
    const store = setup();
    const panel = store.getState().addComponent("panel", "Group", null, { x: 100, y: 100 });
    const node = store.getState().addComponent("system", "Svc", null, { x: 400, y: 300 });

    store.getState().setParent(node.id, panel.id);

    expect(componentOf(store, node.id).parentId).toBe(panel.id);
  });

  it("puts an element back at top level when it leaves the panel", () => {
    const store = setup();
    const panel = store.getState().addComponent("panel", "Group", null, { x: 100, y: 100 });
    const node = store.getState().addComponent("system", "Svc", panel.id);

    store.getState().setParent(node.id, null);

    expect(componentOf(store, node.id).parentId).toBeNull();
  });

  it("moves an element straight from one panel to another", () => {
    const store = setup();
    const first = store.getState().addComponent("panel", "A", null, { x: 0, y: 0 });
    const second = store.getState().addComponent("panel", "B", null, { x: 800, y: 0 });
    const node = store.getState().addComponent("system", "Svc", first.id);

    store.getState().setParent(node.id, second.id);

    expect(componentOf(store, node.id).parentId).toBe(second.id);
  });

  it("keeps a child's position expressed relative to the panel it sits in", () => {
    const store = setup();
    const panel = store.getState().addComponent("panel", "Group", null, { x: 500, y: 400 });
    const node = store.getState().addComponent("system", "Svc", panel.id);

    const panelLayout = layoutOf(store, panel.id);
    const childLayout = layoutOf(store, node.id);

    // A child is stored in panel-local coordinates, so its own x/y stay small
    // however far out on the canvas the panel itself sits.
    expect(panelLayout.x).toBe(500);
    expect(childLayout.x).toBeLessThan(panelLayout.x);
    expect(childLayout.y).toBeLessThan(panelLayout.y);
  });

  it("groups a selection into a new panel that owns them", () => {
    const store = setup();
    const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.getState().addComponent("system", "B", null, { x: 300, y: 0 });

    const panelId = store.getState().groupNodes([a.id, b.id]);
    expect(panelId).not.toBeNull();

    expect(componentOf(store, a.id).parentId).toBe(panelId);
    expect(componentOf(store, b.id).parentId).toBe(panelId);
  });

  it("releases the children when the panel is ungrouped", () => {
    const store = setup();
    const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.getState().addComponent("system", "B", null, { x: 300, y: 0 });
    const panelId = store.getState().groupNodes([a.id, b.id])!;

    store.getState().ungroupNodes(panelId);

    expect(componentOf(store, a.id).parentId).toBeNull();
    expect(componentOf(store, b.id).parentId).toBeNull();
  });

  it("treats both container render types as drop targets", () => {
    // The canvas decides what a node can be dropped into from its React Flow
    // type, and a swimlane renders under its own type rather than "panel".
    expect(isReactFlowParentPanelType("panel")).toBe(true);
    expect(isReactFlowParentPanelType(PanelKind.Swimlane)).toBe(true);
    expect(isReactFlowParentPanelType("system")).toBe(false);
  });

  it("takes an element into a swimlane the same way", () => {
    const store = setup();
    const lane = store
      .getState()
      .addComponent("panel", "Lane", null, { x: 0, y: 0 }, undefined, PanelKind.Swimlane);
    const node = store.getState().addComponent("system", "Svc", null, { x: 400, y: 300 });

    store.getState().setParent(node.id, lane.id);

    expect(componentOf(store, lane.id).type).toBe("panel");
    expect(componentOf(store, node.id).parentId).toBe(lane.id);
  });

  it("creates a swimlane at lane proportions, not panel proportions", () => {
    const store = setup();
    const panel = store.getState().addComponent("panel", "Group", null, { x: 0, y: 0 });
    const lane = store
      .getState()
      .addComponent("panel", "Lane", null, { x: 0, y: 600 }, undefined, PanelKind.Swimlane);

    const panelLayout = layoutOf(store, panel.id);
    const laneLayout = layoutOf(store, lane.id);

    expect(laneLayout.width).not.toBe(panelLayout.width);
    expect(laneLayout.height).not.toBe(panelLayout.height);
  });

  it("gives a new swimlane its lane defaults", () => {
    const store = setup();
    const lane = store
      .getState()
      .addComponent("panel", "Lane", null, { x: 0, y: 0 }, undefined, PanelKind.Swimlane);

    const component = componentOf(store, lane.id);
    expect(component.type).toBe("panel");
    if (component.type !== "panel") return;
    expect(component.panelKind).toBe(PanelKind.Swimlane);
    expect(component.swimlane?.orientation).toBe("horizontal");
    expect(component.swimlane?.laneColor).toBeDefined();
  });

  it("gives a panel kind its own default colour", () => {
    const store = setup();
    const vpc = store
      .getState()
      .addComponent("panel", "VPC", null, { x: 0, y: 0 }, undefined, PanelKind.Vpc);

    const component = componentOf(store, vpc.id);
    if (component.type !== "panel") throw new Error("expected a panel");
    expect(component.panelKind).toBe(PanelKind.Vpc);
    expect(component.panelColor).toBeTruthy();
  });

  it("sits behind its children in the stored layout", () => {
    const store = setup();
    const panel = store.getState().addComponent("panel", "Group", null, { x: 0, y: 0 });
    expect(layoutOf(store, panel.id).zIndex).toBe(-1);
  });
});
