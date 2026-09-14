import { describe, expect, it } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { computeApiGroupSize } from "@/features/diagram/utils/api-group-size";

/**
 * The one behaviour `api-group` and `endpoint` share, and the reason they
 * migrated in the same slice.
 *
 * A group's stored size is its endpoint count: inserting a route grows the
 * frame and removing one shrinks it, without anyone dragging a handle. That
 * logic lives in the store's insertion path (`addComponent`), not in either
 * descriptor — so migrating the two types should leave it untouched. Nothing
 * covered it before, which is exactly why "it should still work" was not
 * something this slice could assert without writing it down.
 */
describe("an api-group is sized by the endpoints it holds", () => {
  function setup() {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Test", "context");
    store.getState().openDiagram(diagram.id);
    return store;
  }

  function groupLayout(store: ReturnType<typeof setup>, groupId: string) {
    const state = store.getState();
    return state.diagrams[state.activeDiagramId!].nodeLayouts[groupId];
  }

  it("starts at the empty-frame size", () => {
    const store = setup();
    const group = store.getState().addComponent("api-group", "API", null, { x: 0, y: 0 });

    const empty = computeApiGroupSize(0);
    const layout = groupLayout(store, group.id);
    expect({ width: layout.width, height: layout.height }).toEqual(empty);
  });

  it("is created behind its children", () => {
    const store = setup();
    const group = store.getState().addComponent("api-group", "API", null, { x: 0, y: 0 });

    // A frame the endpoints sit on top of; `model.defaultZIndex` carries this.
    expect(groupLayout(store, group.id).zIndex).toBe(-1);
  });

  it("grows by one row per endpoint inserted", () => {
    const store = setup();
    const group = store.getState().addComponent("api-group", "API", null, { x: 0, y: 0 });

    for (let count = 1; count <= 3; count += 1) {
      store.getState().addComponent("endpoint", `GET /r${count}`, group.id);
      const layout = groupLayout(store, group.id);
      expect({ width: layout.width, height: layout.height }).toEqual(computeApiGroupSize(count));
    }
  });

  it("stacks each endpoint one row below the last, inside the frame", () => {
    const store = setup();
    const group = store.getState().addComponent("api-group", "API", null, { x: 0, y: 0 });
    const first = store.getState().addComponent("endpoint", "GET /a", group.id);
    const second = store.getState().addComponent("endpoint", "GET /b", group.id);

    const state = store.getState();
    const layouts = state.diagrams[state.activeDiagramId!].nodeLayouts;
    expect(layouts[first.id].y).toBeLessThan(layouts[second.id].y);
    expect(layouts[first.id].width).toBe(layouts[second.id].width);
    expect(layouts[first.id].x).toBe(0);
  });

  it("shrinks again when an endpoint is removed", () => {
    const store = setup();
    const group = store.getState().addComponent("api-group", "API", null, { x: 0, y: 0 });
    const first = store.getState().addComponent("endpoint", "GET /a", group.id);
    store.getState().addComponent("endpoint", "GET /b", group.id);

    store.getState().removeComponent(first.id);

    const layout = groupLayout(store, group.id);
    expect({ width: layout.width, height: layout.height }).toEqual(computeApiGroupSize(1));
  });

  it("gives a standalone endpoint no pinned height", () => {
    const store = setup();
    const endpoint = store.getState().addComponent("endpoint", "GET /loose", null, { x: 0, y: 0 });

    const state = store.getState();
    const layout = state.diagrams[state.activeDiagramId!].nodeLayouts[endpoint.id];
    // `model.defaultSize` declares a width and no height on purpose: outside a
    // group the node measures itself.
    expect(layout.width).toBe(260);
    expect(layout.height).toBeUndefined();
  });
});
