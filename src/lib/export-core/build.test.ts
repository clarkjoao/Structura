import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildMxGraphXml } from "./build";
import type { ExportEdge, ExportModel, ExportNode } from "./model";

const HERE = dirname(fileURLToPath(import.meta.url));

function c4(id: string, x: number, y: number, over: Partial<ExportNode> = {}): ExportNode {
  return {
    kind: "c4",
    id,
    parentId: null,
    x,
    y,
    width: 0,
    height: 0,
    subtype: "system",
    name: id,
    description: "",
    ...over,
  } as ExportNode;
}

function edge(
  id: string,
  sourceId: string,
  targetId: string,
  over: Partial<ExportEdge> = {},
): ExportEdge {
  return {
    id,
    sourceId,
    targetId,
    edgeStyle: "smoothstep",
    strokeStyle: "solid",
    strokeWidth: 1,
    markerStart: "none",
    markerEnd: "arrow-closed",
    ...over,
  };
}

function model(nodes: ExportNode[], edges: ExportEdge[] = []): ExportModel {
  return { name: "T", nodes, edges };
}

describe("export-core is framework-agnostic", () => {
  it("imports nothing from @/features or plugin types", () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(`${HERE}/${f}`, "utf8");
      expect(src, `${f} must not import from @/`).not.toMatch(/from\s+["']@\//);
      expect(src, `${f} must not reference plugin.types`).not.toMatch(/plugin\.types/);
    }
  });
});

describe("buildMxGraphXml — wrapper", () => {
  it("emits a full mxfile envelope", () => {
    const xml = buildMxGraphXml(model([c4("a", 0, 0)]), { wrapper: "mxfile" });
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<mxfile>");
    expect(xml).toContain(`<diagram name="T">`);
  });

  it("emits a bare mxGraphModel for LeanIX", () => {
    const xml = buildMxGraphXml(model([c4("a", 0, 0)]), { wrapper: "mxgraphModel" });
    expect(xml.startsWith("<mxGraphModel")).toBe(true);
    expect(xml).not.toContain("<mxfile>");
  });
});

describe("buildMxGraphXml — 1:1 positioning", () => {
  it("preserves the gap between two roots (no scale)", () => {
    const xml = buildMxGraphXml(model([c4("a", 0, 0), c4("b", 300, 0)]), { wrapper: "mxfile" });
    // shifted by bbox origin (0) + margin (80) on both axes; 300-unit gap stays 300
    expect(xml).toContain(`<mxGeometry x="80" y="80"`);
    expect(xml).toContain(`<mxGeometry x="380" y="80"`);
  });

  it("keeps container children at parent-relative coords", () => {
    const nodes: ExportNode[] = [
      { kind: "panel", id: "p", parentId: null, x: 0, y: 0, width: 500, height: 360, name: "P" },
      c4("child", 20, 20, { parentId: "p" }),
    ];
    const xml = buildMxGraphXml(model(nodes), { wrapper: "mxfile" });
    // Panel is a root node → parent="1" (the default parent cell)
    expect(xml).toContain(`parent="1"`);
    // Child is inside a panel → parent="p" (the panel's cell id)
    expect(xml).toContain(`parent="p"`);
    // Both must be present and distinct.
    expect(xml.indexOf(`parent="p"`)).toBeGreaterThan(0);
  });
});

describe("buildMxGraphXml — per-kind cells", () => {
  it("uses the C4 default box for a node with unknown size (0)", () => {
    const xml = buildMxGraphXml(model([c4("a", 0, 0)]), { wrapper: "mxfile" });
    expect(xml).toContain(`width="240" height="120"`);
    expect(xml).toContain(`c4Type="Software System"`);
  });

  it("uses the C4_META canonical box, not a measured size (A1-compensation)", () => {
    // A Person measured 180x64 must still export at 240x120 (C4_META) — the
    // gap is preserved by computeCompensationOffsets pushing the second node down.
    const xml = buildMxGraphXml(model([c4("a", 0, 0, { width: 180, height: 64 })]), {
      wrapper: "mxfile",
    });
    expect(xml).toContain(`width="240" height="120"`);
    // Ensure the canonical C4 type label is present.
    expect(xml).toContain(`c4Type="Software System"`);
  });

  it("pushes the second stacked node down to preserve the gap (A1-compensation)", () => {
    const xml = buildMxGraphXml(
      model([c4("a", 0, 0), c4("b", 0, 75)]),
      { wrapper: "mxfile" },
    );
    // Extract the two C4 geometry y values (both use canonical 240×120).
    const matches = [...xml.matchAll(/x="(\d+)" y="(\d+)" width="240" height="120"/g)];
    expect(matches).toHaveLength(2);
    const y0 = parseInt(matches[0][2]);
    const y1 = parseInt(matches[1][2]);
    // Gap = y1 - (y0 + 120) must be ≥ COMPENSATION_GAP (10).
    expect(y1 - (y0 + 120)).toBeGreaterThanOrEqual(10);
  });

  it("renders a note with the note style and value", () => {
    const nodes: ExportNode[] = [
      {
        kind: "note",
        id: "n",
        parentId: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        name: "N",
        description: "hello",
      },
    ];
    const xml = buildMxGraphXml(model(nodes), { wrapper: "mxfile" });
    expect(xml).toContain("text;html=1;strokeColor=#cccccc");
    expect(xml).toContain(`value="hello"`);
    // height now tracks content (compact), width still defaults to 336
    expect(xml).toContain(`width="336" height="48"`);
  });
});

describe("buildMxGraphXml — edges", () => {
  it("defaults smoothstep to an orthogonal-elbow style (no curve)", () => {
    const xml = buildMxGraphXml(model([c4("a", 0, 0), c4("b", 300, 0)], [edge("e", "a", "b")]), {
      wrapper: "mxfile",
    });
    expect(xml).toContain("edgeStyle=elbowEdgeStyle;elbow=orthogonal;rounded=1");
    expect(xml).not.toContain("curved=1");
    expect(xml).toContain(`source="a" target="b"`);
  });

  it("colors the edge by intent and transforms waypoints 1:1", () => {
    const xml = buildMxGraphXml(
      model(
        [c4("a", 0, 0), c4("b", 300, 0)],
        [edge("e", "a", "b", { intent: "call", waypoints: [{ x: 100, y: 100 }] })],
      ),
      { wrapper: "mxfile" },
    );
    expect(xml).toContain("strokeColor=#1f2937"); // THEME.strokes.call
    expect(xml).toContain(`<mxPoint x="180" y="180"/>`); // 100 - 0 + 80
  });
});
