import { describe, expect, it } from "vitest";
import type { Component, Diagram, VersionDiff } from "../model";
import { buildReaderCatalog, readerCatalogFrom } from "./reader-catalog";

const component = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, ...partial }) as unknown as Component;

function diagramWith(components: Component[], versions: Record<string, VersionDiff> = {}): Diagram {
  return {
    id: "d1",
    name: "Hub",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    versions,
  };
}

const services = {
  billing: { name: "billing-service" },
  unused: { name: "not referenced" },
};
const diagrams = {
  ledger: { name: "Ledger — Containers" },
  risk: { name: "Risk — Context" },
  other: { name: "not referenced" },
};

describe("buildReaderCatalog", () => {
  it("picks the names the diagram's cards show, and nothing else from the workspace", () => {
    const catalog = buildReaderCatalog(
      diagramWith([
        component({ id: "a", type: "container", serviceId: "billing", linkedDiagramId: "ledger" }),
        component({ id: "x", type: "external-element", referenceDiagramId: "risk" }),
      ]),
      services,
      diagrams,
    );

    expect(catalog).toEqual({
      services: { billing: { name: "billing-service" } },
      diagrams: { ledger: { name: "Ledger — Containers" }, risk: { name: "Risk — Context" } },
    });
  });

  it("includes what a scene adds, since a link can open in one", () => {
    const scene = {
      id: "s1",
      name: "With ledger",
      color: "#000",
      createdAt: 0,
      addedComponents: {
        b: component({ id: "b", type: "container", linkedDiagramId: "ledger" }),
      },
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    } as VersionDiff;

    const catalog = buildReaderCatalog(diagramWith([], { s1: scene }), services, diagrams);

    expect(catalog.diagrams).toEqual({ ledger: { name: "Ledger — Containers" } });
  });

  it("leaves out an id the workspace does not know, as the editor shows nothing for it", () => {
    const catalog = buildReaderCatalog(
      diagramWith([component({ id: "a", type: "container", serviceId: "gone" })]),
      services,
      diagrams,
    );

    expect(catalog.services).toEqual({});
  });
});

describe("readerCatalogFrom", () => {
  it("keeps names and drops everything else a payload might carry", () => {
    expect(
      readerCatalogFrom({
        services: { ok: { name: "ok" }, bad: { name: 3 }, worse: "x" },
        diagrams: { d: { name: "D", extra: true } },
        injected: { name: "ignored" },
      }),
    ).toEqual({ services: { ok: { name: "ok" } }, diagrams: { d: { name: "D" } } });
  });

  it("reads a payload without a catalog — every older link — as empty", () => {
    expect(readerCatalogFrom(undefined)).toEqual({ services: {}, diagrams: {} });
    expect(readerCatalogFrom("nonsense")).toEqual({ services: {}, diagrams: {} });
  });
});
