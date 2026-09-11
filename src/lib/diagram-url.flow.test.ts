import { describe, expect, it } from "vitest";
import type { Diagram, Flow } from "@/features/diagram";
import { decodeShareParam, generateShareUrl, generateViewerUrl } from "./share-url";

/**
 * The script a link opens on.
 *
 * It travels beside the payload rather than inside it, for the same reason
 * `activeSceneId` was taken out of the payload: which script an author wants
 * read is part of the invitation, not part of the diagram. It also means the
 * two can disagree — a link kept after its script was deleted — which is why
 * the reader checks rather than trusts.
 */
const flow = (id: string, name: string): Flow => ({
  id,
  name,
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: { s1: { id: "s1", type: "action" } },
});

function diagram(): Diagram {
  return {
    id: "d1",
    name: "Checkout",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {},
      connections: {},
      flows: { f1: flow("f1", "Checkout"), f2: flow("f2", "Refund") },
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    activeSceneId: null,
  } as unknown as Diagram;
}

const payloadOf = (url: string) => url.split("#share=")[1]!.split("&")[0]!;
const flowOf = (url: string) => new URLSearchParams(url.split("#")[1]).get("flow");

describe("a share link that names a script", () => {
  it("carries the name beside the diagram", () => {
    expect(flowOf(generateShareUrl(diagram(), { flowId: "f2" }).url)).toBe("f2");
  });

  it("carries nothing when none is named", () => {
    expect(flowOf(generateShareUrl(diagram()).url)).toBeNull();
    expect(flowOf(generateShareUrl(diagram(), { flowId: null }).url)).toBeNull();
  });

  it("leaves the payload exactly as it was", () => {
    const withFlow = generateShareUrl(diagram(), { flowId: "f2" }).url;
    const without = generateShareUrl(diagram()).url;

    expect(payloadOf(withFlow)).toBe(payloadOf(without));
    expect(Object.keys(decodeShareParam(payloadOf(withFlow))!.snapshot.flows)).toEqual([
      "f1",
      "f2",
    ]);
  });

  it("does the same for an embed link", () => {
    expect(flowOf(generateViewerUrl(diagram(), { flowId: "f1" }))).toBe("f1");
    expect(flowOf(generateViewerUrl(diagram()))).toBeNull();
  });

  it("escapes an id rather than letting it end the parameter", () => {
    const url = generateShareUrl(diagram(), { flowId: "f&x=1" }).url;

    expect(flowOf(url)).toBe("f&x=1");
  });
});
