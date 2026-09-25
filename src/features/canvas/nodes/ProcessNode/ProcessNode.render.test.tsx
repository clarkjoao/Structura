import { beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider, type Node } from "@xyflow/react";
import type { Component } from "@/features/diagram";
import { getElement } from "@/features/elements/element.registry";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";
import { getNodeTypesSnapshot } from "../node-types/registry";

/**
 * Renders flow nodes for real, the way the canvas does: descriptor data into
 * the registered component inside React Flow. Same jsdom staging as
 * `node-types/handle-spec.render.test.tsx`.
 */
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    private readonly cb: (entries: unknown[], self: unknown) => void;
    constructor(cb: (entries: unknown[], self: unknown) => void) {
      this.cb = cb;
    }
    observe(element: Element): void {
      this.cb([{ target: element, contentRect: { width: 200, height: 100 } }], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
});

function renderFlowNode(component: Component): HTMLElement {
  const descriptor = getElement("process-node")!;
  const nodes: Node[] = [
    {
      id: component.id,
      type: descriptor.canvas.rfType,
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      measured: { width: 200, height: 100 },
      data: descriptor.canvas.buildData(component, emptyNodeBuildContext()),
    },
  ];
  const { container } = render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={getNodeTypesSnapshot()} />
      </div>
    </ReactFlowProvider>,
  );
  return container;
}

const flowNode = (flowShape: string, extra: Record<string, unknown> = {}): Component =>
  ({
    id: `n-${flowShape}`,
    name: "Step",
    description: "",
    parentId: null,
    type: "process-node",
    flowShape,
    ...extra,
  }) as unknown as Component;

describe("a legacy start / end circle", () => {
  it("is drawn as a start, and its stored shape is left alone", () => {
    const legacy = flowNode("circle");
    const before = JSON.stringify(legacy);
    const container = renderFlowNode(legacy);
    expect(container.querySelector("[data-flow-shape]")?.getAttribute("data-flow-shape")).toBe(
      "start",
    );
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("draws an end as an end", () => {
    const container = renderFlowNode(flowNode("end"));
    expect(container.querySelector("[data-flow-shape]")?.getAttribute("data-flow-shape")).toBe(
      "end",
    );
  });
});
