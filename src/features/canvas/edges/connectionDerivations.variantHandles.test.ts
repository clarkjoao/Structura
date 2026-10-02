import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Component, Connection } from "@/features/diagram";
import "@/features/elements/bootstrap";
import "@/features/canvas/nodes/node-types/registry";
import {
  SINGLE_PAIR_HANDLES,
  SPREAD_HANDLES,
} from "@/features/canvas/nodes/node-types/handle-spec";
import {
  hasElement,
  registerElement,
  unregisterElement,
} from "@/features/elements/element.registry";
import type { ElementCanvasSlice, ElementDescriptor } from "@/features/elements/element.types";
import { buildConnectionCountPerNode, buildEdgeHandleAssignments } from "./connectionDerivations";

/**
 * An element whose base canvas spreads its handles but whose variant renders
 * one slot a side: React Flow drops an edge whose handle is missing, so the
 * slots must come from what the component renders, not from its type.
 */
const TYPE = "test-variant-handles";

const canvas = (handles: ElementCanvasSlice["handles"]): ElementCanvasSlice => ({
  rfType: TYPE,
  component: () => null,
  handles,
  role: "card",
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  canBeConnectionSource: true,
  derivesSize: false,
  buildData: () => ({}),
});

const fixture: ElementDescriptor = {
  id: TYPE as never,
  family: "structural",
  labelKey: "canvasToolbar.panel",
  descriptionKey: "elements.panel.description",
  model: {
    createComponent: (base) => ({ ...base, type: TYPE }) as unknown as Component,
    defaultSize: { width: 160, height: 60 },
    patchableKeys: [],
  },
  canvas: canvas(SPREAD_HANDLES),
  variants: [
    {
      matches: (comp) => (comp as unknown as { flat?: boolean }).flat === true,
      canvas: canvas(SINGLE_PAIR_HANDLES),
    },
  ],
  palette: {
    categoryId: "test-variant",
    icon: { kind: "family", iconName: "x" },
    accent: { kind: "neutral" },
    searchKeys: [],
    hidden: true,
  },
  inspector: {},
  export: {
    drawio: { toExportNode: (_comp, base) => ({ ...base, kind: "passthrough" }) as never },
  },
};

const node = (id: string, flat = false): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: TYPE,
    ...(flat ? { flat } : {}),
  }) as unknown as Component;

const link = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

describe("slots come from the canvas a component is drawn with", () => {
  beforeAll(() => {
    if (!hasElement(TYPE)) registerElement(fixture);
  });
  afterAll(() => unregisterElement(TYPE));

  const components = {
    a: node("a"),
    b: node("b"),
    split: node("split", true),
    join: node("join", true),
  };
  const assign = (connections: Connection[]) =>
    Object.fromEntries(
      buildEdgeHandleAssignments(
        connections,
        buildConnectionCountPerNode(connections),
        components,
      ).map((entry) => [entry.connId, entry]),
    );

  it("a variant with one slot a side takes all its edges on it", () => {
    const byId = assign([
      link("x", "a", "join"),
      link("y", "b", "join"),
      link("yes", "split", "a"),
      link("no", "split", "b"),
    ]);
    expect(byId.x.targetHandle).toBe("target-0");
    expect(byId.y.targetHandle).toBe("target-0");
    expect(byId.yes.sourceHandle).toBe("source-0");
    expect(byId.no.sourceHandle).toBe("source-0");
  });

  it("the base canvas keeps spreading its slots", () => {
    const byId = assign([link("x", "a", "b"), link("y", "a", "join")]);
    expect([byId.x.sourceHandle, byId.y.sourceHandle].sort()).toEqual(["source-0", "source-1"]);
  });
});
