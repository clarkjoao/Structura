import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "@/features/diagram";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { resolveViewSnapshot, type DescribeNode } from "./resolveViewSnapshot";

/**
 * A typed container drawn compact, through the one view rule both surfaces
 * use. `describe` stands in for the registry: `box` is a collapsible typed
 * container, everything else a plain node.
 */
const describeNode: DescribeNode = (c) =>
  (c.type as string) === "box"
    ? { canHaveParent: true, zIndex: -1, acceptsChildren: ["system"], collapsible: true }
    : { canHaveParent: true, zIndex: 0 };

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function diagram(collapsed: boolean): Diagram {
  const box = comp({
    id: "box",
    name: "Box",
    type: "box",
    ...(collapsed ? { collapsed: true } : {}),
  });
  return {
    id: "d",
    name: "D",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        box,
        shard1: comp({ id: "shard1", name: "shard-1", type: "system", parentId: "box" }),
        shard2: comp({ id: "shard2", name: "shard-2", type: "system", parentId: "box" }),
        app: comp({ id: "app", name: "App", type: "system" }),
      },
      connections: {
        toShard: { id: "toShard", sourceId: "app", targetId: "shard1", label: "reads" },
        inside: { id: "inside", sourceId: "shard1", targetId: "shard2", label: "replicates" },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      box: { elementId: "box", x: 0, y: 0, width: 400, height: 300 },
      shard1: { elementId: "shard1", x: 20, y: 60, width: 160, height: 60 },
      shard2: { elementId: "shard2", x: 200, y: 60, width: 160, height: 60 },
      app: { elementId: "app", x: -300, y: 0, width: 160, height: 60 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

const view = (d: Diagram) => resolveViewSnapshot(d, { versionId: null }, describeNode);

describe("a compact typed container", () => {
  it("nests its children like a panel does", () => {
    const expanded = view(diagram(false));
    expect(expanded.panelIds.has("box")).toBe(true);
    expect(expanded.nodes.find((n) => n.component.id === "shard1")?.isChild).toBe(true);
  });

  it("hides its children and draws their edges on itself", () => {
    const compact = view(diagram(true));
    expect(compact.compactContainerIds.has("box")).toBe(true);
    expect(compact.nodes.find((n) => n.component.id === "shard1")?.isHidden).toBe(true);
    expect(compact.nodes.find((n) => n.component.id === "box")?.isHidden).toBe(false);
    const toShard = compact.shownConnections.find((c) => c.id === "toShard");
    expect(toShard).toMatchObject({ sourceId: "app", targetId: "box" });
    // Both ends inside the box: nothing to draw.
    expect(compact.shownConnections.map((c) => c.id)).not.toContain("inside");
    // Handle counts are built from the same remapped connections.
    expect(compact.placedConnections.find((c) => c.id === "toShard")?.targetId).toBe("box");
  });

  it("expanded, draws every edge where it is stored", () => {
    const expanded = view(diagram(false));
    expect(expanded.shownConnections.find((c) => c.id === "toShard")?.targetId).toBe("shard1");
    expect(expanded.shownConnections.map((c) => c.id)).toContain("inside");
  });

  it("changes the drawing only: the diagram hashes the same before and after the view", () => {
    for (const collapsed of [false, true]) {
      const d = diagram(collapsed);
      const surface = () => ({ ...d.snapshot, nodeLayouts: d.nodeLayouts, edgeLayouts: {} });
      const before = snapshotChecksum(surface());
      const json = JSON.stringify(d);
      view(d);
      expect(JSON.stringify(d)).toBe(json);
      expect(snapshotChecksum(surface())).toBe(before);
    }
  });

  it("a panel's collapse keeps its old behaviour: edges into it are not redrawn", () => {
    const d = diagram(false);
    d.snapshot.components.box = comp({ id: "box", name: "Box", type: "panel", collapsed: true });
    const panelView = view(d);
    expect(panelView.compactContainerIds.size).toBe(0);
    expect(panelView.shownConnections.find((c) => c.id === "toShard")?.targetId).toBe("shard1");
  });
});
