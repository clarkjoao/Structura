import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "@/features/diagram";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { resolveViewSnapshot, type DescribeNode } from "./resolveViewSnapshot";
import { projectNodes } from "./projectDiagram";
import { compactTabBox } from "./compactView";
import { emptyNodeBuildContext } from "@/features/elements/node-build-context.fixture";

/**
 * Children that stay on screen as tabs while their parent is compact: a
 * sidecar on a compact workload. `pod` is a collapsible container; a child
 * named `side-*` is a tab, the rest hide as usual.
 */
const describeNode: DescribeNode = (c) =>
  (c.type as string) === "pod"
    ? { canHaveParent: true, zIndex: -1, acceptsChildren: ["system"], collapsible: true }
    : {
        canHaveParent: true,
        zIndex: 0,
        tabOnCompactParent: (child: Component) => child.name.startsWith("side-"),
      };

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function diagram(podCompact: boolean, outerCompact = false): Diagram {
  return {
    id: "d",
    name: "D",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        outer: comp({
          id: "outer",
          name: "outer",
          type: "pod",
          ...(outerCompact ? { collapsed: true } : {}),
        }),
        pod: comp({
          id: "pod",
          name: "api",
          type: "pod",
          parentId: "outer",
          ...(podCompact ? { collapsed: true } : {}),
        }),
        main: comp({ id: "main", name: "app", type: "system", parentId: "pod" }),
        logs: comp({ id: "logs", name: "side-logs", type: "system", parentId: "pod" }),
        envoy: comp({ id: "envoy", name: "side-envoy", type: "system", parentId: "pod" }),
        ing: comp({ id: "ing", name: "ingress", type: "system" }),
      },
      connections: {
        inbound: { id: "inbound", sourceId: "ing", targetId: "envoy", label: "http" },
        toMain: { id: "toMain", sourceId: "ing", targetId: "main", label: "direct" },
        inPod: { id: "inPod", sourceId: "envoy", targetId: "main", label: "localhost" },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      outer: { elementId: "outer", x: 0, y: 0, width: 900, height: 600 },
      pod: { elementId: "pod", x: 20, y: 40, width: 300, height: 400 },
      main: { elementId: "main", x: 150, y: 80, width: 120, height: 60 },
      envoy: { elementId: "envoy", x: 10, y: 80, width: 120, height: 60 },
      logs: { elementId: "logs", x: 10, y: 200, width: 120, height: 60 },
      ing: { elementId: "ing", x: -300, y: 0, width: 160, height: 60 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

const view = (d: Diagram) => resolveViewSnapshot(d, { versionId: null }, describeNode);
const nodeOf = (v: ReturnType<typeof view>, id: string) =>
  v.nodes.find((n) => n.component.id === id)!;

describe("tabs on a compact parent", () => {
  it("expanded, nothing is a tab", () => {
    const v = view(diagram(false));
    expect(v.compactTabIds.size).toBe(0);
    expect(nodeOf(v, "envoy").tabIndex).toBeUndefined();
  });

  it("compact: the tab children stay shown, in order, the others hide", () => {
    const v = view(diagram(true));
    expect(nodeOf(v, "envoy")).toMatchObject({ isHidden: false, tabIndex: 0 });
    expect(nodeOf(v, "logs")).toMatchObject({ isHidden: false, tabIndex: 1 });
    expect(nodeOf(v, "main").isHidden).toBe(true);
    expect(nodeOf(v, "main").tabIndex).toBeUndefined();
  });

  it("an edge to a tab ends on the tab; one to a hidden child lands on the parent", () => {
    const v = view(diagram(true));
    const byId = Object.fromEntries(v.shownConnections.map((c) => [c.id, c]));
    expect(byId.inbound).toMatchObject({ sourceId: "ing", targetId: "envoy" });
    expect(byId.toMain).toMatchObject({ sourceId: "ing", targetId: "pod" });
    // tab → hidden sibling stays inside the card the tab belongs to: not drawn.
    expect(byId.inPod).toBeUndefined();
  });

  it("a tab hides with its parent when something above compacts the parent away", () => {
    const v = view(diagram(true, true));
    expect(v.compactTabIds.has("envoy")).toBe(true);
    expect(nodeOf(v, "envoy").isHidden).toBe(true);
    expect(v.shownConnections.find((c) => c.id === "inbound")?.targetId).toBe("outer");
  });

  it("draws a tab at a box derived from its parent, not at its stored place, and does not let it move", () => {
    const d = diagram(true);
    const v = view(d);
    const nodes = projectNodes(v, emptyNodeBuildContext(), { kind: "edit" } as never, (c) => ({
      ...describeNode(c),
      rfType: "x",
      component: () => null,
      matches: () => true,
      connectable: true,
      handles: {} as never,
      canBeParent: true,
      buildData: () => ({}),
      buildStyle: () => ({ width: 120, height: 60 }),
    }));
    const envoy = nodes.find((n) => n.id === "envoy")!;
    const box = compactTabBox(0, 300);
    expect(envoy.position).toEqual({ x: box.x, y: box.y });
    expect(envoy.style).toMatchObject({ width: box.width, height: box.height });
    expect(envoy.draggable).toBe(false);
    expect(envoy.extent).toBeUndefined();
    expect(nodes.find((n) => n.id === "logs")!.position.y).toBe(compactTabBox(1, 300).y);
  });

  it("changes the drawing only", () => {
    const d = diagram(true);
    const surface = () => ({ ...d.snapshot, nodeLayouts: d.nodeLayouts, edgeLayouts: {} });
    const before = snapshotChecksum(surface());
    const json = JSON.stringify(d);
    view(d);
    expect(JSON.stringify(d)).toBe(json);
    expect(snapshotChecksum(surface())).toBe(before);
  });
});
