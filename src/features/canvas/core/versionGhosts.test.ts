import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "@/features/diagram";
import { versionChanges } from "@/features/diagram/utils/version.utils";
import type { DescribeNode } from "./resolveViewSnapshot";
import { versionGhostView } from "./versionGhosts";

const component = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;
const describeNode: DescribeNode = (c) => ({
  canHaveParent: true,
  zIndex: c.type === "panel" ? -1 : 0,
});

/** A panel P holding api and cache; the Version removes cache and the edge to it. */
function diagram(): Diagram {
  return {
    id: "d",
    name: "d",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        P: component({ id: "P", name: "P", type: "panel", panelKind: "default" }),
        api: component({ id: "api", name: "api", type: "system", parentId: "P" }),
        cache: component({ id: "cache", name: "cache", type: "system", parentId: "P" }),
        web: component({ id: "web", name: "web", type: "system" }),
      },
      connections: {
        reads: { id: "reads", sourceId: "api", targetId: "cache", label: "reads" },
        calls: { id: "calls", sourceId: "web", targetId: "api", label: "calls" },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      P: { elementId: "P", x: 0, y: 0, width: 600, height: 300 },
      api: { elementId: "api", x: 40, y: 40 },
      cache: { elementId: "cache", x: 300, y: 40 },
      web: { elementId: "web", x: -300, y: 40 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    activeVersionId: "v",
    versions: {
      v: {
        id: "v",
        name: "v",
        color: "#000",
        createdAt: 0,
        addedComponents: {},
        addedConnections: {},
        removedComponentIds: ["cache"],
        removedConnectionIds: [],
        nodeLayouts: {},
      },
    },
  };
}

describe("versionGhostView", () => {
  it("keeps the removed element at its base place, nested in its live parent, with its edge", () => {
    const d = diagram();
    const view = versionGhostView(
      d,
      versionChanges(d, "v")!,
      new Set(["P", "api", "web"]),
      describeNode,
    )!;
    expect(view.nodes.map((n) => [n.component.id, n.isChild, n.layout?.x])).toEqual([
      ["cache", true, 300],
    ]);
    // The edge goes with the element it touched, though the Version did not list it.
    expect(view.shownConnections.map((c) => c.id)).toEqual(["reads"]);
  });

  it("draws a ghost on its own when its parent is not drawn", () => {
    const d = diagram();
    const view = versionGhostView(d, versionChanges(d, "v")!, new Set(["api"]), describeNode)!;
    expect(view.nodes[0]).toMatchObject({ isChild: false });
  });

  it("is null when the Version removes nothing", () => {
    const d = diagram();
    d.versions!.v!.removedComponentIds = [];
    expect(
      versionGhostView(d, versionChanges(d, "v")!, new Set(["P", "api", "cache"]), describeNode),
    ).toBeNull();
  });
});
