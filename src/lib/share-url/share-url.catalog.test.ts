import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import {
  decodeDiagramPayload,
  decodeShareParam,
  decodeSharePayload,
  generateShareUrl,
  generateViewerUrl,
} from "./index";
import { decodeDiagramPayloadWithCatalog } from "./decode";

/** As a reader receives each link: `URLSearchParams` undoes the percent-encoding. */
const hashParam = (url: string, key: string) => new URLSearchParams(url.split("#")[1]).get(key)!;

const diagram: Diagram = {
  id: "d1",
  name: "Hub",
  level: "container",
  createdAt: 0,
  updatedAt: 0,
  snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
  nodeLayouts: {},
  edgeLayouts: {},
  viewport: { x: 0, y: 0, zoom: 1 },
};

const catalog = {
  services: { billing: { name: "billing-service" } },
  diagrams: { ledger: { name: "Ledger — Containers" } },
};

describe("a link carries the names its cards show", () => {
  it("through a share link", () => {
    const shared = decodeSharePayload(
      hashParam(generateShareUrl(diagram, { catalog }).url, "share"),
    );

    expect(shared?.catalog).toEqual(catalog);
  });

  it("through an embed link", () => {
    const shared = decodeDiagramPayloadWithCatalog(
      hashParam(generateViewerUrl(diagram, { catalog }), "data"),
    );

    expect(shared.catalog).toEqual(catalog);
  });

  it("keeps the names off the diagram, so an import never stores them", () => {
    const share = decodeShareParam(hashParam(generateShareUrl(diagram, { catalog }).url, "share"));
    const embed = decodeDiagramPayload(hashParam(generateViewerUrl(diagram, { catalog }), "data"));

    expect(share).not.toHaveProperty("readerCatalog");
    expect(embed).not.toHaveProperty("readerCatalog");
    expect(share?.name).toBe("Hub");
  });

  it("writes nothing extra when there are no names to carry", () => {
    const empty = { services: {}, diagrams: {} };

    expect(generateViewerUrl(diagram, { catalog: empty })).toBe(generateViewerUrl(diagram));
  });

  it("reads a link written before the names travelled as having none", () => {
    const shared = decodeSharePayload(hashParam(generateShareUrl(diagram).url, "share"));

    expect(shared?.catalog).toEqual({ services: {}, diagrams: {} });
  });
});
