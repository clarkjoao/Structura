import { describe, expect, it } from "vitest";
import { runtimeImportsOf } from "@/test/runtime-imports";
import type { Component, Diagram } from "@/features/diagram";
import {
  resolveViewScene,
  resolveViewSnapshot,
  sortForRender,
  type DescribeNode,
} from "./resolveViewSnapshot";

/**
 * `resolveViewSnapshot` is the one rule for what the canvas shows, and
 * `projectDiagram` the one projection of it; both have to stay usable anywhere — a headless test, the viewer's lazy chunk, a future
 * plugin host. The element registry is passed in for that reason; these tests
 * keep the module from growing a path back to the store.
 */

/*
 * Store, LLM, collaboration and React Flow. React itself is not on the list:
 * the model's type guards (`component.guards.ts`) import the cloud barrel and
 * i18n, which reach React — a dependency of the domain model, not of this
 * module, and out of this slice's scope.
 */
const FORBIDDEN = /src\/features\/(diagram\/store|llm|collaboration)\/|node_modules\/@xyflow\//;

const component = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

const describeNode: DescribeNode = (c) => ({
  canHaveParent: true,
  zIndex: c.type === "panel" ? -1 : 0,
});

function diagram(extra: Partial<Diagram> = {}): Diagram {
  return {
    id: "pure",
    name: "Pure",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        a: component({ id: "a", name: "a", type: "system", parentId: "P" }),
        P: component({ id: "P", name: "P", type: "panel", panelKind: "default" }),
      },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      a: { elementId: "a", x: 10, y: 10 },
      P: { elementId: "P", x: 0, y: 0 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...extra,
  };
}

describe("resolveViewSnapshot is pure", () => {
  // The view rule (slice 4) and the projection built on it (slice 5).
  for (const module of ["resolveViewSnapshot.ts", "projectDiagram.ts"]) {
    it(`${module} reaches no store, LLM, collaboration or React Flow module`, () => {
      const reached = runtimeImportsOf(`src/features/canvas/core/${module}`);
      expect(reached.length).toBeGreaterThan(1);
      expect(reached.filter((file) => FORBIDDEN.test(file))).toEqual([]);
    });
  }

  it("would notice a path to the store: the viewer's projection, which uses the registry, has one", () => {
    const reached = runtimeImportsOf("src/features/canvas/core/projectReadDiagram.ts");
    expect(reached.some((file) => FORBIDDEN.test(file))).toBe(true);
  });

  it("works with a descriptor lookup of the caller's choosing", () => {
    const view = resolveViewSnapshot(diagram(), { versionId: null }, describeNode);
    expect(view.nodes.map((node) => [node.component.id, node.zIndex, node.isChild])).toEqual([
      ["P", -1, false],
      ["a", 0, true],
    ]);
  });
});

describe("the editor keeps the snapshot identity its memos depend on", () => {
  it("returns the cached snapshot when asked for the scenes the diagram has open", () => {
    const d = diagram();
    expect(resolveViewScene(d, { versionId: null })).toBe(resolveViewScene(d, { versionId: null }));
  });

  it("resolves the base afresh when a link asks for it while the author sits in a scene", () => {
    const d = diagram({
      activeVersionId: "s1",
      versions: {
        s1: {
          id: "s1",
          name: "s1",
          color: "#000",
          createdAt: 0,
          addedComponents: {},
          addedConnections: {},
          removedComponentIds: ["a"],
          removedConnectionIds: [],
          nodeLayouts: {},
        },
      },
    });
    expect(Object.keys(resolveViewScene(d, { versionId: "s1" }).components)).toEqual(["P"]);
    expect(Object.keys(resolveViewScene(d, { versionId: null }).components).sort()).toEqual([
      "P",
      "a",
    ]);
  });
});

describe("render order", () => {
  it("puts containers first, then shallower before deeper, and keeps ties in insertion order", () => {
    const byId: Record<string, Component> = {
      c2: component({ id: "c2", type: "system", parentId: "P2" }),
      c1: component({ id: "c1", type: "system", parentId: "P1" }),
      P1: component({ id: "P1", type: "panel", panelKind: "default" }),
      P2: component({ id: "P2", type: "panel", panelKind: "default" }),
      root: component({ id: "root", type: "system" }),
    };
    expect(sortForRender(Object.values(byId), byId).map((c) => c.id)).toEqual([
      "P1",
      "P2",
      "root",
      "c2",
      "c1",
    ]);
  });
});
