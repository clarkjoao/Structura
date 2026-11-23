import { describe, expect, it } from "vitest";
import { buildMxGraphXml } from "./build";
import type { ExportModel } from "./model";

const base: ExportModel = { name: "D", nodes: [], edges: [] };

describe("export decorations", () => {
  it("writes a locked layer with labelled rectangles and open lines", () => {
    const xml = buildMxGraphXml(
      {
        ...base,
        decorations: {
          layerName: "Phases",
          rects: [{ id: "p1", label: "Discover", x: 100, y: -100, width: 200, height: 28 }],
          lines: [
            {
              id: "sep",
              points: [
                { x: 300, y: 0 },
                { x: 300, y: 400 },
              ],
              dashed: true,
            },
            {
              id: "curve",
              points: [
                { x: 150, y: -60 },
                { x: 250, y: -20 },
                { x: 350, y: -50 },
              ],
            },
          ],
        },
      },
      { wrapper: "mxgraphModel" },
    );
    expect(xml).toContain(
      `<mxCell id="structura-decorations" value="Phases" style="locked=1;" parent="0"/>`,
    );
    // Shifted into positive space with the rest: the band's top is the drawing's top.
    expect(xml).toMatch(
      /<mxCell id="p1" value="Discover" style="[^"]*structuraDecoration=1;" vertex="1" parent="structura-decorations"><mxGeometry x="\d+" y="\d+" width="200" height="28"/,
    );
    expect(xml).toMatch(/<mxCell id="sep" value="" style="[^"]*dashed=1;[^"]*" edge="1"/);
    expect(xml).toMatch(/<mxCell id="curve"[^>]*>.*<Array as="points"><mxPoint x="\d+" y="\d+"\/>/);
    expect(xml).not.toMatch(/x="-\d/);
  });

  it("writes no layer without decorations", () => {
    expect(buildMxGraphXml(base, { wrapper: "mxgraphModel" })).not.toContain(
      "structura-decorations",
    );
    expect(
      buildMxGraphXml(
        { ...base, decorations: { layerName: "Phases", rects: [], lines: [] } },
        { wrapper: "mxgraphModel" },
      ),
    ).not.toContain("structura-decorations");
  });
});
