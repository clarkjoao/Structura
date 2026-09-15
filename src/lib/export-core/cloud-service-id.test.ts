import { describe, expect, it } from "vitest";
import { buildCell } from "./cell-builders";
import type { ExportNode } from "./model";

/**
 * Domain cloud-service identity must survive into the mxGraph XML as a
 * programmatically readable attribute — not only as icon appearance.
 *
 * LeanIX finding (documented, not fixed here): the plugin adapter still does
 * not set `cloudServiceId` on ExportNodes it builds, so its XML will keep
 * omitting this attribute until that adapter converges.
 */

const geometry = { x: 10, y: 20, width: 80, height: 80 };

describe("cloudServiceId on export cells", () => {
  it("wraps aws cells in <object cloudServiceId> when the id is set", () => {
    const node: ExportNode = {
      kind: "aws",
      id: "a1",
      parentId: null,
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      name: "Lambda",
      awsIcon: "lambda",
      cloudServiceId: "lambda",
    };
    const xml = buildCell(node, geometry, "1");
    expect(xml).toContain('cloudServiceId="lambda"');
    expect(xml).toContain("<object placeholders=\"1\"");
    expect(xml).toContain("prIcon=mxgraph.aws4.lambda");
  });

  it("keeps bare aws mxCell when cloudServiceId is absent", () => {
    const node: ExportNode = {
      kind: "aws",
      id: "a1",
      parentId: null,
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      name: "Lambda",
      awsIcon: "lambda",
    };
    const xml = buildCell(node, geometry, "1");
    expect(xml).not.toContain("cloudServiceId=");
    expect(xml.startsWith("<mxCell")).toBe(true);
  });

  it("wraps image cells in <object cloudServiceId> when the id is set", () => {
    const node: ExportNode = {
      kind: "image",
      id: "g1",
      parentId: null,
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      name: "Cloud Run",
      dataUri: "data:image/svg+xml;base64,PHN2Zy8+",
      cloudServiceId: "cloudrun",
    };
    const xml = buildCell(node, geometry, "1");
    expect(xml).toContain('cloudServiceId="cloudrun"');
    expect(xml).toContain("shape=image");
  });

  it("adds cloudServiceId next to structuraType on passthrough cells", () => {
    const node: ExportNode = {
      kind: "passthrough",
      id: "az1",
      parentId: null,
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      name: "Functions",
      originType: "azure-compute",
      originLabel: "Azure",
      cloudServiceId: "functions",
    };
    const xml = buildCell(node, geometry, "1");
    expect(xml).toContain('cloudServiceId="functions"');
    expect(xml).toContain('structuraType="azure-compute"');
  });
});
