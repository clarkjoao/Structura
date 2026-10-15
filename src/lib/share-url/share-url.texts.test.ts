import { describe, expect, it } from "vitest";
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";
import { encodeDiagramPayload, generateShareUrl } from "./encode";

function diagram(textsVisible?: boolean): Diagram {
  return {
    id: "d",
    name: "d",
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components: {
        a: { id: "a", name: "service", description: "", parentId: null, type: "container" },
        t: { id: "t", name: "PRIVATE-PLAN-NOTE", description: "", parentId: null, type: "text" },
      },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { a: { elementId: "a", x: 0, y: 0 }, t: { elementId: "t", x: 0, y: 0 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...(textsVisible === undefined ? {} : { textsVisible }),
  } as Diagram;
}

const decodePayload = (encoded: string) =>
  JSON.parse(LZString.decompressFromEncodedURIComponent(encoded)!) as string;

describe("a share link and the text layer", () => {
  it("does not carry the texts while the layer is off", () => {
    const { url } = generateShareUrl(diagram());
    const encoded = decodeURIComponent(url.split("#share=")[1]!);
    expect(JSON.stringify(decodePayload(encoded))).not.toContain("PRIVATE-PLAN-NOTE");
    expect(encodeDiagramPayload(diagram())).not.toBe("");
    expect(
      LZString.decompressFromEncodedURIComponent(encodeDiagramPayload(diagram())),
    ).not.toContain("PRIVATE-PLAN-NOTE");
  });

  it("carries them, and the flag, when the layer is on", () => {
    const json = LZString.decompressFromEncodedURIComponent(encodeDiagramPayload(diagram(true)))!;
    expect(json).toContain("PRIVATE-PLAN-NOTE");
    expect(json).toContain('"textsVisible":true');
  });
});
