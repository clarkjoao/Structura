import { describe, expect, it } from "vitest";
import { buildCell } from "./cell-builders";
import { CONFIG } from "./constants";
import type { ExportNode } from "./model";

/**
 * The two kinds that exist so every element can export.
 *
 * Before these, `svg`, `unknown`, `process-node` and `external-element` threw
 * on the way to draw.io — an element with no native shape simply could not
 * leave Structura. `image` keeps the artwork; `passthrough` keeps the identity
 * of everything else.
 */

const geometry = { x: 10, y: 20, width: 300, height: 200 };

function imageNode(over: Partial<Extract<ExportNode, { kind: "image" }>> = {}): ExportNode {
  return {
    kind: "image",
    id: "n1",
    parentId: null,
    x: 10,
    y: 20,
    width: 300,
    height: 200,
    name: "Logo",
    dataUri: "data:image/svg+xml;base64,PHN2Zy8+",
    ...over,
  };
}

function passthroughNode(
  over: Partial<Extract<ExportNode, { kind: "passthrough" }>> = {},
): ExportNode {
  return {
    kind: "passthrough",
    id: "n2",
    parentId: null,
    x: 10,
    y: 20,
    width: 300,
    height: 200,
    name: "Mystery",
    originType: "unknown",
    originLabel: "Unknown",
    ...over,
  };
}

describe("image cells", () => {
  it("embeds the data URI as a draw.io image shape", () => {
    const xml = buildCell(imageNode(), geometry, "1");

    expect(xml).toContain("shape=image");
    expect(xml).toContain("image=data:image/svg+xml;base64,PHN2Zy8+");
    expect(xml).toContain('value="Logo"');
    expect(xml).toContain('width="300" height="200"');
  });

  it("keeps the aspect ratio unless the node opts out", () => {
    expect(buildCell(imageNode(), geometry, "1")).toContain("imageAspect=1");
    expect(buildCell(imageNode({ preserveAspect: false }), geometry, "1")).toContain(
      "imageAspect=0",
    );
  });

  it("falls back to a passthrough box when the picture is too large", () => {
    // One oversized drawing would otherwise dominate the whole export file.
    const huge = "data:image/svg+xml;base64," + "A".repeat(CONFIG.limits.imageDataUriChars);
    const xml = buildCell(imageNode({ dataUri: huge }), geometry, "1");

    expect(xml).not.toContain("shape=image");
    expect(xml).toContain("dashed=1");
    // The name survives, and so does the fact that it was an SVG.
    expect(xml).toContain("Logo");
    expect(xml).toContain('structuraType="svg"');
  });

  it("stays an image right up to the ceiling", () => {
    const atLimit = "A".repeat(CONFIG.limits.imageDataUriChars);
    expect(buildCell(imageNode({ dataUri: atLimit }), geometry, "1")).toContain("shape=image");
  });
});

describe("passthrough cells", () => {
  it("draws a dashed neutral box rather than pretending to be a shape", () => {
    const xml = buildCell(passthroughNode(), geometry, "1");

    expect(xml).toContain("dashed=1");
    expect(xml).toContain(`fillColor=${CONFIG.defaults.passthroughFill}`);
    expect(xml).toContain(`strokeColor=${CONFIG.defaults.passthroughStroke}`);
  });

  it("carries the origin type so a later import can recover it", () => {
    const xml = buildCell(passthroughNode(), geometry, "1");

    expect(xml).toContain("<object placeholders=\"1\"");
    expect(xml).toContain('structuraType="unknown"');
    expect(xml).toContain('structuraLabel="Unknown"');
  });

  it("shows the description when there is one, and the type name otherwise", () => {
    const withDescription = buildCell(
      passthroughNode({ description: "Raw payload" }),
      geometry,
      "1",
    );
    expect(withDescription).toContain("Raw payload");

    const without = buildCell(passthroughNode(), geometry, "1");
    expect(without).toContain("Unknown");
  });

  it("falls back to the configured size when the node has none", () => {
    const xml = buildCell(passthroughNode(), { x: 0, y: 0, width: 0, height: 0 }, "1");

    expect(xml).toContain(
      `width="${CONFIG.defaults.passthroughWidth}" height="${CONFIG.defaults.passthroughHeight}"`,
    );
  });

  it("escapes a name that would otherwise break the XML", () => {
    const xml = buildCell(passthroughNode({ name: 'a<b>&"c' }), geometry, "1");

    expect(xml).not.toContain("<b>&");
    expect(xml).toContain("&lt;b&gt;");
  });
});
