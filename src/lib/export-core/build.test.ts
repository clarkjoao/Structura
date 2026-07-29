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
    // Structura defaults: source=right, target=left (set by the real mapEdge).
    exitX: 1,
    exitY: 0.5,
    entryX: 0,
    entryY: 0.5,
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
    // c4() helper uses subtype="system" → 200×80 (matches canvas CustomNode).
    expect(xml).toContain(`width="200" height="80"`);
    expect(xml).toContain(`c4Type="Software System"`);
  });

  it("uses the C4_META canonical box, not a measured size (A1-compensation)", () => {
    // A System measured 200x72 must still export at 200x80 (C4_META) — the
    // gap is preserved by computeCompensationOffsets pushing the second node down.
    const xml = buildMxGraphXml(model([c4("a", 0, 0, { width: 200, height: 72 })]), {
      wrapper: "mxfile",
    });
    expect(xml).toContain(`width="200" height="80"`);
    // Ensure the canonical C4 type label is present.
    expect(xml).toContain(`c4Type="Software System"`);
  });

  it("pushes the second stacked node down to preserve the gap (A1-compensation)", () => {
    const xml = buildMxGraphXml(
      model([c4("a", 0, 0), c4("b", 0, 75)]),
      { wrapper: "mxfile" },
    );
    // Extract the two C4 geometry y values (both use canonical 200×80).
    const matches = [...xml.matchAll(/x="(\d+)" y="(\d+)" width="200" height="80"/g)];
    expect(matches).toHaveLength(2);
    const y0 = parseInt(matches[0][2]);
    const y1 = parseInt(matches[1][2]);
    // Gap = y1 - (y0 + 80) must be ≥ COMPENSATION_GAP (10).
    expect(y1 - (y0 + 80)).toBeGreaterThanOrEqual(10);
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

  it("clamps C4 boxes between the canonical floor and per-subtype ceiling", () => {
    // No measured size → falls back to the canonical C4_META box.
    const fallback = buildMxGraphXml(
      model([
        c4("a", 0, 0, { subtype: "system", description: "tiny" }),
      ]),
      { wrapper: "mxfile" },
    );
    expect(fallback).toMatch(/id="a"[\s\S]{0,800}width="200" height="80"/);

    // Measured size bigger than floor but below ceiling → grows with content.
    const grown = buildMxGraphXml(
      model([
        c4("a", 0, 0, {
          subtype: "system",
          width: 280,
          height: 110,
          description: "long description that wraps onto multiple lines",
        }),
      ]),
      { wrapper: "mxfile" },
    );
    expect(grown).toMatch(/id="a"[\s\S]{0,800}width="280" height="110"/);

    // Measured size above the ceiling → clamped to the ceiling (maxWidth=320,
    // maxHeight=140 for system). Keeps the diagram layout stable even for
    // 5-paragraph descriptions.
    const clamped = buildMxGraphXml(
      model([
        c4("a", 0, 0, {
          subtype: "system",
          width: 800,
          height: 400,
          description: "ridiculously long description that should be clamped",
        }),
      ]),
      { wrapper: "mxfile" },
    );
    expect(clamped).toMatch(/id="a"[\s\S]{0,800}width="320" height="140"/);
  });

  it("emits per-subtype C4 boxes that match the canvas (180×70, 200×80)", () => {
    // Pins C4_META so a future drift between the canvas CustomNode and the
    // export surfaces as a test failure instead of a proportion regression.
    const persons: ExportNode[] = [
      { ...c4("a", 0, 0), subtype: "person" } as ExportNode,
      { ...c4("b", 300, 0), subtype: "system" } as ExportNode,
      { ...c4("c", 600, 0), subtype: "container" } as ExportNode,
      { ...c4("d", 900, 0), subtype: "component" } as ExportNode,
    ];
    const xml = buildMxGraphXml(model(persons), { wrapper: "mxfile" });
    // Person: 180×70 (smaller, matches canvas measured ~180×64 with a few px headroom).
    expect(xml).toContain('id="a"><mxCell');
    // Geometry appears later in the same node's XML; search for the full substring.
    expect(xml).toMatch(/id="a"[\s\S]{0,800}width="180" height="70"/);
    // System/Container/Component: 200×80 (matches canvas ~200×72 with headroom).
    expect(xml).toMatch(/id="b"[\s\S]{0,800}width="200" height="80"/);
    expect(xml).toMatch(/id="c"[\s\S]{0,800}width="200" height="80"/);
    expect(xml).toMatch(/id="d"[\s\S]{0,800}width="200" height="80"/);
  });
});

describe("buildMxGraphXml — edges", () => {
  it("defaults smoothstep to an orthogonal style with rounded corners (no curve)", () => {
    const xml = buildMxGraphXml(model([c4("a", 0, 0), c4("b", 300, 0)], [edge("e", "a", "b")]), {
      wrapper: "mxfile",
    });
    // orthogonalEdgeStyle supports multi-bend routes (when target is
    // below+left of source), unlike elbowEdgeStyle which is single-bend only.
    expect(xml).toContain("edgeStyle=orthogonalEdgeStyle;rounded=1");
    expect(xml).not.toContain("curved=1");
    expect(xml).not.toContain("elbowEdgeStyle");
    expect(xml).toContain(`source="a" target="b"`);
  });

  it("writes exitX/exitY/entryX/entryY anchors (right-exit, left-entry)", () => {
    // Every edge must anchor exitX=1 (right side of source) and entryX=0 (left
    // side of target) — matching Structura's Position.Right source handles and
    // Position.Left target handles.  Without anchors the elbow routes from/to the
    // node centre, visibly wrong with orthogonal routing.
    const xml = buildMxGraphXml(model([c4("a", 0, 0), c4("b", 300, 0)], [edge("e", "a", "b")]), {
      wrapper: "mxfile",
    });
    expect(xml).toContain('exitX="1"');
    expect(xml).toContain('exitY="0.5"');
    expect(xml).toContain('entryX="0"');
    expect(xml).toContain('entryY="0.5"');
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
