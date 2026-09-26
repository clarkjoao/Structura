import { describe, expect, it } from "vitest";
import { EdgeStyle } from "@/features/diagram";
import { parseDrawioXml } from "./import-drawio";

/** Two plain boxes joined by one edge with the given style. */
function xmlWithEdgeStyle(style: string): string {
  return (
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
    `<mxCell id="a" value="A" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell>` +
    `<mxCell id="b" value="B" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="300" y="0" width="100" height="60" as="geometry"/></mxCell>` +
    `<mxCell id="e" value="" style="${style}" edge="1" source="a" target="b" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>` +
    `</root></mxGraphModel>`
  );
}

describe("importing information-flow edges", () => {
  it("reads draw.io's electronic information flow as a zigzag", () => {
    const result = parseDrawioXml(
      xmlWithEdgeStyle(
        "edgeStyle=none;shape=mxgraph.lean_mapping.electronic_info_flow_edge;html=1;",
      ),
      { x: 0, y: 0 },
      {},
    );
    expect(result.connections.map((c) => c.style?.edgeStyle)).toEqual([EdgeStyle.Zigzag]);
  });

  it("still reads a plain edgeStyle=none as straight", () => {
    const result = parseDrawioXml(xmlWithEdgeStyle("edgeStyle=none;html=1;"), { x: 0, y: 0 }, {});
    expect(result.connections.map((c) => c.style?.edgeStyle)).toEqual([EdgeStyle.Straight]);
  });
});
