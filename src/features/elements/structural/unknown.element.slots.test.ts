import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram/model/component.types";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import { unknownElement } from "./unknown.element";

/**
 * Seen on the canvas: a saved diagram still holding a removed family's element
 * (an `sfn-state`) drew it as `unknown` with no handles at all, so React Flow
 * dropped every edge to it (#008). The node renders a slot per edge a side.
 */
const ctx = {
  selectedNodeId: null,
  connectionCounts: { x: { incoming: 2, outgoing: 1 } },
  versionBadgeByComponentId: {},
} as unknown as NodeBuildContext;

describe("the unknown element's data", () => {
  it("gives a removed type its name, its type and a slot per edge", () => {
    const removed = {
      id: "x",
      name: "X",
      type: "sfn-state",
      parentId: null,
    } as unknown as Component;
    expect(unknownElement.canvas.buildData(removed, ctx)).toMatchObject({
      name: "X",
      rawContent: "sfn-state",
      incomingCount: 2,
      outgoingCount: 1,
    });
  });

  it("keeps an unknown component's own content", () => {
    const unknown = {
      id: "x",
      name: "X",
      type: "unknown",
      rawContent: "raw",
      parentId: null,
    } as unknown as Component;
    expect(unknownElement.canvas.buildData(unknown, ctx)).toMatchObject({
      rawContent: "raw",
      incomingCount: 2,
    });
  });
});
