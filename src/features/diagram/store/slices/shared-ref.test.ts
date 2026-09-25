import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { buildFlowHighlight } from "@/features/canvas/flow/flowState";
import type { Flow } from "../../model/flow.types";

function setup() {
  const store = createTestDiagramStore();
  const d = store.getState().addDiagram("Refs", "container");
  store.getState().openDiagram(d.id);
  const s = store.getState();
  const auth = s.addComponent("container", "Auth", null, { x: 0, y: 0 });
  s.updateComponent(auth.id, { shared: { mode: "ref" } });
  const orders = s.addComponent("container", "Orders", null, { x: 0, y: 300 });
  const ref = (x: number) =>
    s.addComponent("shared-ref", "Auth", null, { x, y: 300 }, undefined, undefined, undefined, {
      refOf: auth.id,
    });
  const r1 = ref(300);
  const r2 = ref(600);
  s.addConnection(orders.id, r1.id, "gRPC");
  const components = () => store.getState().diagrams[d.id].snapshot.components;
  const connections = () => store.getState().diagrams[d.id].snapshot.connections;
  return { store, diagramId: d.id, auth, orders, r1, r2, components, connections };
}

describe("references", () => {
  it("are created standing for the original, with nothing else of their own", () => {
    const ctx = setup();
    expect(ctx.components()[ctx.r1.id]).toMatchObject({ type: "shared-ref", refOf: ctx.auth.id });
    expect(ctx.store.getState().diagrams[ctx.diagramId].nodeLayouts[ctx.r1.id]).toMatchObject({
      width: 200,
      height: 48,
    });
  });

  it("go with the original, said once, and come back with one undo", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.auth.id);
    expect(ctx.components()[ctx.r1.id]).toBeUndefined();
    expect(ctx.components()[ctx.r2.id]).toBeUndefined();
    // The edge that ended on a reference went with it.
    expect(Object.keys(ctx.connections())).toHaveLength(0);
    expect(ctx.store.getState()._sharedRefNotice).toMatchObject({ name: "Auth", count: 2 });
    ctx.store.getState().undo();
    expect(ctx.components()[ctx.r1.id]).toBeDefined();
    expect(ctx.components()[ctx.r2.id]).toBeDefined();
    expect(Object.keys(ctx.connections())).toHaveLength(1);
  });

  it("removing one reference leaves the original and the other reference", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.r1.id);
    expect(ctx.components()[ctx.auth.id]).toBeDefined();
    expect(ctx.components()[ctx.r2.id]).toBeDefined();
    expect(ctx.store.getState()._sharedRefNotice).toBeNull();
  });

  it("the batch removal takes them too", () => {
    const ctx = setup();
    ctx.store.getState().removeElements([ctx.auth.id, ctx.orders.id], []);
    expect(Object.keys(ctx.components())).toEqual([]);
    expect(ctx.store.getState()._sharedRefNotice).toMatchObject({ count: 2 });
  });

  it("a step on the original lights the original and its references", () => {
    const ctx = setup();
    const flow = {
      id: "f",
      name: "F",
      entryStepId: "s1",
      steps: { s1: { id: "s1", type: "action", componentId: ctx.auth.id } },
    } as unknown as Flow;
    const highlight = buildFlowHighlight(flow, "s1", [], {
      components: ctx.components(),
      compactIds: new Set(),
    });
    expect(highlight.activeNodeId).toBe(ctx.auth.id);
    expect([...highlight.litNodeIds].sort()).toEqual([ctx.auth.id, ctx.r1.id, ctx.r2.id].sort());
  });
});
