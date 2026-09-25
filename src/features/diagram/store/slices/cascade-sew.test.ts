import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FlowStep } from "../../model/flow.types";
import { createTestDiagramStore } from "../test-utils";
import {
  TEST_CONTAINER,
  registerTestContainer,
  unregisterTestContainer,
} from "@/features/elements/typedContainer.fixture";

beforeAll(registerTestContainer);
afterAll(unregisterTestContainer);

/**
 * F4: deleting a container deletes what is inside it, and every step on it or
 * on anything inside it is sewn out — said once, named after the container,
 * and undone with it.
 */
describe("deleting a typed container sews the flow in one go", () => {
  function setup() {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Cascade", "container");
    store.getState().openDiagram(diagram.id);
    const s = store.getState();
    const a = s.addComponent("system", "A", null, { x: 0, y: 0 });
    const box = s.addComponent(TEST_CONTAINER as never, "Pedidos", null, { x: 300, y: 0 });
    const shard1 = s.addComponent("system", "shard-1", box.id);
    const shard2 = s.addComponent("system", "shard-2", box.id);
    const b = s.addComponent("system", "B", null, { x: 900, y: 0 });
    const steps: Record<string, FlowStep> = {
      s1: { id: "s1", type: "action", componentId: a.id, next: "s2" },
      s2: { id: "s2", type: "action", componentId: shard1.id, next: "s3" },
      s3: { id: "s3", type: "action", componentId: shard2.id, next: "s4" },
      s4: { id: "s4", type: "action", componentId: b.id },
    } as Record<string, FlowStep>;
    const flow = s.addFlow(diagram.id, "Checkout", "", steps)!;
    return { store, diagramId: diagram.id, flowId: flow.id, a, b, box, shard1, shard2 };
  }

  const flowOf = (ctx: ReturnType<typeof setup>) =>
    ctx.store.getState().diagrams[ctx.diagramId].snapshot.flows[ctx.flowId];
  const walk = (ctx: ReturnType<typeof setup>) => {
    const flow = flowOf(ctx);
    const out: string[] = [];
    let id = flow.entryStepId;
    while (id) {
      out.push(flow.steps[id].componentId!);
      id = flow.steps[id].next;
    }
    return out;
  };

  it("A → shard-1 → shard-2 → B becomes A → B", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.box.id);
    expect(walk(ctx)).toEqual([ctx.a.id, ctx.b.id]);
    const components = ctx.store.getState().diagrams[ctx.diagramId].snapshot.components;
    expect(components[ctx.shard1.id]).toBeUndefined();
    expect(components[ctx.shard2.id]).toBeUndefined();
  });

  it("says it once, naming the container, from A to B", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.box.id);
    const notices = ctx.store.getState()._flowSewNotices!.notices;
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ flowName: "Checkout", elementName: "Pedidos" });
    expect(notices[0].fromLabel).toBeDefined();
    expect(notices[0].toLabel).toBeDefined();
  });

  it("undoes the container, its children and the steps together", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.box.id);
    ctx.store.getState().undo();
    expect(walk(ctx)).toEqual([ctx.a.id, ctx.shard1.id, ctx.shard2.id, ctx.b.id]);
  });

  it("deleting one child alone still says it the old way, named after the child", () => {
    const ctx = setup();
    ctx.store.getState().removeComponent(ctx.shard1.id);
    const notices = ctx.store.getState()._flowSewNotices!.notices;
    expect(notices).toHaveLength(1);
    expect(notices[0].elementName).toBe("shard-1");
  });
});

describe("grouping sewn joins", () => {
  it("removedRoots: maps descendants to the element the user removed, and survives a cycle", async () => {
    const { removedRoots } = await import("../../utils/flow-repair");
    const parents: Record<string, string | null> = { box: null, a: "box", b: "a", x: "y", y: "x" };
    const roots = removedRoots(
      new Set(["box", "a", "b", "x", "y"]),
      new Set(["box", "x"]),
      (id) => parents[id],
    );
    expect(roots.get("b")).toBe("box");
    expect(roots.get("a")).toBe("box");
    expect(roots.get("box")).toBe("box");
    expect(roots.get("y")).toBe("x");
  });

  it("toFlowSewNotices: one notice from the first join's start to the last join's end", async () => {
    const { toFlowSewNotices } = await import("../../utils/flow-repair");
    const notices = toFlowSewNotices(
      [
        {
          flowId: "f",
          flowName: "F",
          blocked: [],
          joins: [
            { stepId: "s2", componentId: "a", fromLabel: "1", toLabel: "2" },
            { stepId: "s3", componentId: "b", fromLabel: "2", toLabel: "3" },
          ],
        },
      ],
      new Map([["box", "Pedidos"]]),
      new Map([
        ["a", "box"],
        ["b", "box"],
      ]),
    );
    expect(notices).toEqual([
      { flowId: "f", flowName: "F", elementName: "Pedidos", fromLabel: "1", toLabel: "3" },
    ]);
  });
});
