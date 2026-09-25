import { describe, expect, it } from "vitest";
import { EdgeStyle } from "@/features/diagram";
import { buildMxGraphXml } from "@/lib/export-core/build";
import type { ExportModel, ExportNode } from "@/lib/export-core/model";
import { parseDrawioXml } from "./import-drawio";

const box = (id: string, x: number): ExportNode =>
  ({
    kind: "stencil",
    id,
    parentId: null,
    x,
    y: 0,
    width: 120,
    height: 60,
    name: id,
    shapeStyle: "rounded=1;",
    accentColor: "#64748b",
    fill: "none",
    dashed: false,
  }) as ExportNode;

function exported(edgeStyle: "catch" | "editable-step"): string {
  return buildMxGraphXml(
    {
      name: "c",
      nodes: [box("a", 0), box("b", 300)],
      edges: [
        {
          id: "e",
          sourceId: "a",
          targetId: "b",
          label: "Catch · States.ALL",
          edgeStyle,
          strokeStyle: "solid",
          strokeWidth: 1,
          markerStart: "none",
          markerEnd: "arrow-closed",
        },
      ],
    } as unknown as ExportModel,
    { wrapper: "mxfile" },
  );
}

describe("the catch edge style", () => {
  it("exports dashed in the destructive red, tagged, whatever the stored stroke", () => {
    const xml = exported("catch");
    expect(xml).toMatch(
      /id="e"[^>]*style="[^"]*structuraEdge=catch;[^"]*dashed=1;[^"]*strokeColor=#dc2828;/,
    );
    expect(exported("editable-step")).not.toContain("structuraEdge=catch");
    expect(exported("editable-step")).not.toContain("#dc2828");
  });

  it("comes back from draw.io as a catcher, not as a plain step", () => {
    const back = parseDrawioXml(exported("catch"), { x: 0, y: 0 }, {});
    expect(back.connections.map((c) => c.style?.edgeStyle)).toEqual([EdgeStyle.Catch]);
    const plain = parseDrawioXml(exported("editable-step"), { x: 0, y: 0 }, {});
    expect(plain.connections.map((c) => c.style?.edgeStyle)).not.toContain(EdgeStyle.Catch);
  });
});
