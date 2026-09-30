import { describe, expect, it } from "vitest";
import { buildEdgeCell } from "./edge-builder";
import type { ExportEdge } from "./model";

/** The stroke a cell is written with. */
const styleOf = (extra: Partial<ExportEdge>) => {
  const xml = buildEdgeCell({
    id: "e",
    sourceId: "a",
    targetId: "b",
    label: "",
    edgeStyle: "editable-step",
    strokeStyle: "solid",
    strokeWidth: 1,
    markerStart: "none",
    markerEnd: "arrow-closed",
    ...extra,
  } as ExportEdge);
  return /style="([^"]*)"/.exec(xml)![1];
};

describe("an exported edge's stroke", () => {
  it("is solid unless dashed or dotted, each with its own pattern", () => {
    expect(styleOf({})).not.toContain("dashed=1");
    expect(styleOf({ strokeStyle: "dashed" })).toContain("dashed=1;dashPattern=8 4;");
    expect(styleOf({ strokeStyle: "dotted" })).toContain("dashed=1;dashPattern=2 4;");
  });

  it("writes a start arrow only when there is one, and a width only when it is not 1", () => {
    expect(styleOf({})).not.toContain("startArrow");
    expect(styleOf({ markerStart: "arrow-closed" })).toContain("startArrow=block;");
    expect(styleOf({})).not.toContain("strokeWidth=");
    expect(styleOf({ strokeWidth: 3 })).toContain("strokeWidth=3;");
  });
});
