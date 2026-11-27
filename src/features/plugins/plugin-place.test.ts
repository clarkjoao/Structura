import { describe, expect, it } from "vitest";
import { planDiagramAutoLayout } from "@/features/canvas/layout/autoLayoutDiagram";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { diagramFromImporterGraph, type ImporterGraphInput } from "./graph-diagram";
import { pluginLayout } from "./plugin-layout";
import { placeGraph } from "./plugin-place";
import type { PluginLayoutBox } from "./plugin.types";

const card = (key: string, parentKey?: string) => ({
  key,
  name: key,
  type: "container",
  x: 0,
  y: 0,
  ...(parentKey && { parentKey }),
});

/** api → db, api → queue, inside a panel; web → api from outside. */
const base: ImporterGraphInput = {
  components: [
    { key: "shop", name: "shop", type: "panel", x: 0, y: 0 },
    card("api", "shop"),
    card("db", "shop"),
    card("web"),
  ],
  connections: [
    { source: "web", target: "api", label: "calls" },
    { source: "api", target: "db", label: "reads" },
  ],
};

const overlaps = (a: PluginLayoutBox, b: PluginLayoutBox) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const asPrevious = (graph: ImporterGraphInput, boxes: Record<string, PluginLayoutBox>) =>
  Object.fromEntries(
    graph.components.map((c) => [c.key, { ...boxes[c.key]!, parentKey: c.parentKey ?? null }]),
  );

describe("api.layout.place — the canvas's placement for a plugin's graph", () => {
  it("with nothing drawn, is the canvas's Arrange of the same graph, labels included", async () => {
    const boxes = await placeGraph({ graph: base });
    const diagram = diagramFromImporterGraph(base, "x");
    const plan = await planDiagramAutoLayout({
      components: diagram.snapshot.components,
      connections: Object.values(diagram.snapshot.connections),
      nodeLayouts: diagram.nodeLayouts,
      autoRefs: false,
    });
    for (const layout of plan.layouts) {
      expect(boxes[layout.elementId]).toMatchObject({ x: layout.x, y: layout.y });
    }
    // Reads left to right: web, then the panel holding api, then db.
    expect(boxes["web"]!.x + boxes["web"]!.width).toBeLessThanOrEqual(boxes["shop"]!.x);
    expect(boxes["api"]!.x + boxes["api"]!.width).toBeLessThan(boxes["db"]!.x);
  });

  it("sizes elements as the canvas draws them, whatever the graph says", async () => {
    const huge = {
      ...base,
      components: base.components.map((c) => ({ ...c, width: 999, height: 999 })),
    };
    const boxes = await placeGraph({ graph: huge });
    expect(boxes["web"]!.width).not.toBe(999);
    expect(boxes["web"]).toEqual((await placeGraph({ graph: base }))["web"]);
  });

  it("with nothing new, keeps every box exactly", async () => {
    const first = await placeGraph({ graph: base });
    const moved = { ...first, web: { ...first["web"]!, x: -500, y: 900 } };
    expect(await placeGraph({ graph: base, previous: asPrevious(base, moved) })).toEqual(moved);
  });

  it("puts a new element beside what it is connected from, keeping the rest in place", async () => {
    const first = await placeGraph({ graph: base });
    const next: ImporterGraphInput = {
      components: [...base.components, card("queue", "shop")],
      connections: [...base.connections, { source: "api", target: "queue", label: "publishes" }],
    };
    const boxes = await placeGraph({ graph: next, previous: asPrevious(base, first) });
    for (const key of ["web", "api", "db"]) {
      expect(boxes[key]).toMatchObject({ x: first[key]!.x, y: first[key]!.y });
    }
    const queue = boxes["queue"]!;
    expect(queue.x).toBeGreaterThan(boxes["api"]!.x + boxes["api"]!.width);
    for (const key of ["api", "db"]) expect(overlaps(queue, boxes[key]!), key).toBe(false);
    // The panel grew to hold it.
    expect(boxes["shop"]!.height).toBeGreaterThanOrEqual(queue.y + queue.height);
  });

  it("follows the diagram's reading direction: top to bottom puts it below", async () => {
    const first = await placeGraph({ graph: base, direction: "TB" });
    const next: ImporterGraphInput = {
      components: [...base.components, card("audit")],
      connections: [...base.connections, { source: "web", target: "audit", label: "logs" }],
    };
    const boxes = await placeGraph({
      graph: next,
      previous: asPrevious(base, first),
      direction: "TB",
    });
    expect(boxes["audit"]!.y).toBeGreaterThan(boxes["web"]!.y + boxes["web"]!.height);
  });

  it("a new panel keeps its arrangement inside and lands where it overlaps nothing", async () => {
    const first = await placeGraph({ graph: base });
    const next: ImporterGraphInput = {
      components: [
        ...base.components,
        { key: "billing", name: "billing", type: "panel", x: 0, y: 0 },
        card("invoices", "billing"),
        card("ledger", "billing"),
      ],
      connections: [...base.connections, { source: "invoices", target: "ledger", label: "posts" }],
    };
    const boxes = await placeGraph({ graph: next, previous: asPrevious(base, first) });
    for (const key of ["web", "shop"])
      expect(overlaps(boxes["billing"]!, boxes[key]!), key).toBe(false);
    expect(boxes["invoices"]!.x + boxes["invoices"]!.width).toBeLessThan(boxes["ledger"]!.x);
  });

  it("api.layout.place reads the named diagram's direction", async () => {
    const created = useDiagramStore.getState().addDiagram("place-tb", "container");
    useDiagramStore.setState((s) => ({
      diagrams: { ...s.diagrams, [created.id]: { ...s.diagrams[created.id]!, direction: "TB" } },
    }));
    const { boxes } = await pluginLayout.place({ graph: base, diagramId: created.id });
    expect(boxes).toEqual(await placeGraph({ graph: base, direction: "TB" }));
    expect(boxes).not.toEqual(await placeGraph({ graph: base }));
  });
});

describe("api.layout.place — previous without a size", () => {
  it("a kept element with no known size takes the canvas's size for its type", async () => {
    const first = await placeGraph({ graph: base });
    const unsized = Object.fromEntries(
      Object.entries(asPrevious(base, first)).map(([k, b]) => [k, { ...b, width: 0, height: 0 }]),
    );
    const boxes = await placeGraph({ graph: base, previous: unsized });
    expect(boxes["web"]).toMatchObject({ x: first["web"]!.x, y: first["web"]!.y });
    expect(boxes["web"]!.width).toBeGreaterThan(0);
  });
});

describe("api.layout.place — a new container around what is drawn", () => {
  it("places its new children so they overlap nothing drawn, and grows to hold them all", async () => {
    // "web" was drawn at the root; it now sits inside a new panel, with a new sibling.
    const first = await placeGraph({ graph: base });
    const next: ImporterGraphInput = {
      components: [
        ...base.components.filter((c) => c.key !== "web"),
        { key: "edge", name: "edge", type: "panel", x: 0, y: 0 },
        card("web", "edge"),
        card("cdn", "edge"),
      ],
      connections: [...base.connections, { source: "cdn", target: "web", label: "serves" }],
    };
    const previous = {
      ...asPrevious(base, first),
      web: { ...first["web"]!, x: 40, y: 40, parentKey: "edge" },
    };
    const boxes = await placeGraph({ graph: next, previous });
    expect(boxes["web"]).toMatchObject({ x: 40, y: 40 });
    expect(overlaps(boxes["cdn"]!, boxes["web"]!)).toBe(false);
    for (const key of ["web", "cdn"]) {
      expect(boxes["edge"]!.width).toBeGreaterThanOrEqual(boxes[key]!.x + boxes[key]!.width);
      expect(boxes["edge"]!.height).toBeGreaterThanOrEqual(boxes[key]!.y + boxes[key]!.height);
    }
  });
});
