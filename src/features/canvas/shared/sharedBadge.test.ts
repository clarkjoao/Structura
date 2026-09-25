import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "@/features/diagram";
import "@/features/elements/bootstrap";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { projectReadDiagram } from "../core/projectReadDiagram";
import { buildSharedLayer } from "./sharedLayerModel";

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, type: "container", ...partial }) as unknown as Component;

function diagram(mode?: "badge"): Diagram {
  return {
    id: "d",
    name: "D",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        auth: comp({ id: "auth", name: "Auth", ...(mode ? { shared: { mode } } : {}) }),
        a: comp({ id: "a", name: "Orders" }),
        b: comp({ id: "b", name: "Billing" }),
        db: comp({ id: "db", name: "DB" }),
      },
      connections: {
        e1: { id: "e1", sourceId: "a", targetId: "auth", label: "gRPC" },
        e2: { id: "e2", sourceId: "b", targetId: "auth", label: "HTTP" },
        e3: { id: "e3", sourceId: "a", targetId: "db", label: "SQL" },
        e4: { id: "e4", sourceId: "auth", targetId: "db", label: "SQL" },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      auth: { elementId: "auth", x: 400, y: 0, width: 200, height: 80 },
      a: { elementId: "a", x: 0, y: 0, width: 200, height: 80 },
      b: { elementId: "b", x: 0, y: 200, width: 200, height: 80 },
      db: { elementId: "db", x: 400, y: 200, width: 200, height: 80 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

describe("badge mode", () => {
  it("draws every edge while the element is drawn with its edges", () => {
    expect(
      projectReadDiagram(diagram())
        .edges.map((e) => e.id)
        .sort(),
    ).toEqual(["e1", "e2", "e3", "e4"]);
    expect(
      buildSharedLayer(diagram().snapshot.components, diagram().snapshot.connections).originals,
    ).toEqual([]);
  });

  it("hides the edges into it, keeps its own and the others, and changes no data", () => {
    const d = diagram("badge");
    const surface = () => ({ ...d.snapshot, nodeLayouts: d.nodeLayouts, edgeLayouts: {} });
    const before = snapshotChecksum(surface());
    const { edges } = projectReadDiagram(d);
    expect(edges.map((e) => e.id).sort()).toEqual(["e3", "e4"]);
    expect(Object.keys(d.snapshot.connections)).toHaveLength(4);
    expect(snapshotChecksum(surface())).toBe(before);
  });

  it("shows them again while revealed", () => {
    const shown = projectReadDiagram(diagram("badge"), null, null, null, undefined, {
      originals: new Set(["auth"]),
    });
    expect(shown.edges).toHaveLength(4);
  });

  it("puts a badge on each consumer, the name of the element only, the protocol for the hover", () => {
    const d = diagram("badge");
    const layer = buildSharedLayer(d.snapshot.components, d.snapshot.connections);
    expect(layer.originals).toHaveLength(1);
    expect(layer.originals[0]).toMatchObject({ id: "auth", name: "Auth", mode: "badge", uses: 2 });
    expect(layer.originals[0].consumers).toEqual([
      { id: "a", name: "Orders", protocols: ["gRPC"] },
      { id: "b", name: "Billing", protocols: ["HTTP"] },
    ]);
    expect([...layer.badgesByConsumer.entries()]).toEqual([
      ["a", ["auth"]],
      ["b", ["auth"]],
    ]);
    expect(layer.anchorIds.sort()).toEqual(["a", "auth", "b"]);
  });
});
