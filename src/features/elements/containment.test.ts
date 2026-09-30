import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import {
  TEST_CONTAINER as CONTAINER,
  registerTestContainer,
  unregisterTestContainer,
} from "./typedContainer.fixture";
import { canContain, isCompactContainer, isTypedContainerType } from "./containment";

beforeAll(registerTestContainer);
afterAll(unregisterTestContainer);

describe("canContain", () => {
  it("lets a typed container take only the children it lists", () => {
    expect(canContain(CONTAINER, "system")).toBe(true);
    expect(canContain(CONTAINER, "container")).toBe(false);
  });

  it("leaves a panel taking anything, as it always has", () => {
    expect(canContain("panel", "system")).toBe(true);
    expect(canContain("panel", CONTAINER)).toBe(true);
  });

  it("refuses a parent that is not a container", () => {
    expect(canContain("system", "container")).toBe(false);
  });

  it("knows a typed container from a panel", () => {
    expect(isTypedContainerType(CONTAINER)).toBe(true);
    expect(isTypedContainerType("panel")).toBe(false);
  });
});

describe("isCompactContainer", () => {
  const comp = (type: string, collapsed?: boolean) =>
    ({
      id: "c",
      name: "c",
      description: "",
      parentId: null,
      type,
      collapsed,
    }) as unknown as Component;

  it("is the collapsed flag on a collapsible type only", () => {
    expect(isCompactContainer(comp(CONTAINER, true))).toBe(true);
    expect(isCompactContainer(comp(CONTAINER))).toBe(false);
    // A panel's collapsed keeps its old meaning.
    expect(isCompactContainer(comp("panel", true))).toBe(false);
  });
});

describe("the store refuses what a container does not take, on every path", () => {
  function setup() {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Test", "context");
    store.getState().openDiagram(diagram.id);
    const container = store
      .getState()
      .addComponent(CONTAINER as never, "Box", null, { x: 0, y: 0 });
    return { store, container };
  }
  const componentOf = (store: ReturnType<typeof setup>["store"], id: string) => {
    const state = store.getState();
    return state.diagrams[state.activeDiagramId!].snapshot.components[id];
  };

  it("setParent: takes a system, refuses a container, with nothing to undo", () => {
    const { store, container } = setup();
    const ok = store.getState().addComponent("system", "Svc", null, { x: 500, y: 500 });
    const no = store.getState().addComponent("container", "Api", null, { x: 600, y: 500 });
    store.getState().setParent(ok.id, container.id);
    const pastBefore = store.getState().past.length;
    store.getState().setParent(no.id, container.id);
    expect(componentOf(store, ok.id).parentId).toBe(container.id);
    expect(componentOf(store, no.id).parentId).toBeNull();
    expect(store.getState().past.length).toBe(pastBefore);
  });

  it("addComponent: a refused child is created at the top level", () => {
    const { store, container } = setup();
    const no = store.getState().addComponent("container", "Api", container.id);
    const ok = store.getState().addComponent("system", "Svc", container.id);
    expect(componentOf(store, no.id).parentId).toBeNull();
    expect(componentOf(store, ok.id).parentId).toBe(container.id);
  });

  it("batchCommitNodeDrag: a refused child keeps its parent", () => {
    const { store, container } = setup();
    const no = store.getState().addComponent("container", "Api", null, { x: 600, y: 500 });
    store
      .getState()
      .batchCommitNodeDrag([
        { nodeId: no.id, newParentId: container.id, newPosition: { x: 10, y: 10 } },
      ]);
    expect(componentOf(store, no.id).parentId).toBeNull();
  });
});
