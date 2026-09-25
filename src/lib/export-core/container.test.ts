import { describe, expect, it } from "vitest";
import { buildMxGraphXml } from "./build";
import type { ExportModel, ExportNode } from "./model";

function container(over: Partial<Extract<ExportNode, { kind: "container" }>> = {}): ExportNode {
  return {
    kind: "container",
    id: "store",
    parentId: null,
    x: 0,
    y: 0,
    width: 480,
    height: 260,
    name: "Pedidos",
    label: "Pedidos · hash(customer_id) · 4 shards",
    accentColor: "#1d67c9",
    fill: "none",
    dashed: false,
    representations: [
      { id: "store-seg-0", label: "s1", x: 12, y: 40, width: 100, height: 26 },
      { id: "store-seg-1", label: "s2", x: 115, y: 40, width: 100, height: 26, fillOpacity: 28 },
    ],
    ...over,
  };
}

const child: ExportNode = {
  kind: "flowNode",
  id: "shard-1",
  parentId: "store",
  x: 20,
  y: 90,
  width: 180,
  height: 80,
  name: "shard-1",
  shape: "rectangle",
  accentColor: "#1d67c9",
  fill: "none",
  dashed: false,
};

const xmlOf = (nodes: ExportNode[]) =>
  buildMxGraphXml({ name: "c", nodes, edges: [] } as ExportModel, { wrapper: "mxfile" });

describe("container export", () => {
  it("is a draw.io container whose children are its cells", () => {
    const xml = xmlOf([container(), child]);
    expect(xml).toMatch(/id="store"[^>]*style="swimlane;container=1;collapsible=1;/);
    expect(xml).toMatch(/id="shard-1"[^>]*parent="store"/);
  });

  it("exports representations as non-connectable cells inside it", () => {
    const xml = xmlOf([container()]);
    expect(xml).toMatch(
      /id="store-seg-0" value="s1" style="[^"]*connectable=0;[^"]*" vertex="1" parent="store"/,
    );
    expect(xml).toMatch(/id="store-seg-1"[^>]*fillOpacity=28;/);
  });

  it("exports compact as a collapsed container keeping the expanded box", () => {
    const xml = xmlOf([container({ compact: { width: 260, height: 72 } }), child]);
    expect(xml).toMatch(/id="store"[^>]*collapsed="1"/);
    expect(xml).toContain('width="260" height="72" as="geometry"');
    expect(xml).toContain('width="480" height="260" as="alternateBounds"');
    // The child is still in the file, under its container.
    expect(xml).toMatch(/id="shard-1"[^>]*parent="store"/);
  });

  it("draws a replica stack as a shadow, and a dashed container dashed", () => {
    const xml = xmlOf([container({ stacked: true, dashed: true })]);
    expect(xml).toMatch(/id="store"[^>]*style="[^"]*shadow=1;[^"]*dashed=1;/);
  });
});
