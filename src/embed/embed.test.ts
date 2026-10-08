import { describe, expect, it } from "vitest";
import { buildPreviewDiagram, changedComponentIds, PREVIEW_DIAGRAM_ID } from "./build-diagram";
import { LOAD_GRAPH, PROBE, SEARCH, THEME, readEmbedMessage, type PreviewGraph } from "./protocol";

const graph: PreviewGraph = {
  components: [
    {
      key: "ApplicationService/orders",
      name: "orders",
      type: "panel",
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    },
    {
      key: "Application/api",
      name: "api",
      type: "aws-compute",
      cloudServiceId: "lambda",
      parentKey: "ApplicationService/orders",
      x: 40,
      y: 40,
    },
    {
      key: "Database/db",
      name: "db",
      type: "aws-database",
      cloudServiceId: "dynamodb",
      x: 600,
      y: 0,
    },
  ],
  connections: [{ source: "Application/api", target: "Database/db", label: "writes" }],
};

describe("readEmbedMessage", () => {
  it("reads a graph and a theme", () => {
    expect(readEmbedMessage({ type: LOAD_GRAPH, components: [], connections: [] })).toEqual({
      type: LOAD_GRAPH,
      graph: { components: [], connections: [] },
    });
    expect(readEmbedMessage({ type: THEME, theme: "dark" })).toEqual({
      type: THEME,
      theme: "dark",
    });
  });

  it("ignores anything else", () => {
    for (const data of [
      null,
      "x",
      { type: "OTHER" },
      { type: THEME, theme: "blue" },
      { type: LOAD_GRAPH },
    ]) {
      expect(readEmbedMessage(data)).toBeNull();
    }
  });
});

describe("buildPreviewDiagram", () => {
  it("draws the graph with stable ids, nesting and catalog services", () => {
    const diagram = buildPreviewDiagram(graph);
    expect(diagram.id).toBe(PREVIEW_DIAGRAM_ID);
    const { components, connections } = diagram.snapshot;
    expect(Object.keys(components).sort()).toEqual([
      "Application/api",
      "ApplicationService/orders",
      "Database/db",
    ]);
    expect(components["Application/api"]).toMatchObject({
      parentId: "ApplicationService/orders",
      cloudServiceId: "lambda",
    });
    expect(diagram.nodeLayouts["Database/db"]).toMatchObject({ elementId: "Database/db", x: 600 });
    expect(Object.values(connections)).toMatchObject([
      { sourceId: "Application/api", targetId: "Database/db", label: "writes" },
    ]);
  });

  it("gives the same ids to the same graph every time", () => {
    const a = buildPreviewDiagram(graph);
    const b = buildPreviewDiagram(graph);
    expect(Object.keys(b.snapshot.components)).toEqual(Object.keys(a.snapshot.components));
    expect(Object.keys(b.snapshot.connections)).toEqual(Object.keys(a.snapshot.connections));
  });
});

describe("changedComponentIds", () => {
  const graph = (over: { name?: string; x?: number; extra?: boolean; edge?: boolean } = {}) => ({
    components: [
      { key: "a", name: over.name ?? "a", type: "container", x: over.x ?? 0, y: 0 },
      { key: "b", name: "b", type: "container", x: 300, y: 0 },
      ...(over.extra ? [{ key: "c", name: "c", type: "container", x: 600, y: 0 }] : []),
    ],
    connections: over.edge ? [{ source: "a", target: "b", label: "calls" }] : [],
  });

  it("is empty for the first graph and for moves only", () => {
    expect(changedComponentIds(null, graph())).toEqual([]);
    expect(changedComponentIds(graph(), graph({ x: 50 }))).toEqual([]);
  });

  it("names new and edited components and the ends of new connections", () => {
    expect(changedComponentIds(graph(), graph({ extra: true }))).toEqual(["c"]);
    expect(changedComponentIds(graph(), graph({ name: "renamed" }))).toEqual(["a"]);
    expect(changedComponentIds(graph(), graph({ edge: true })).sort()).toEqual(["a", "b"]);
  });
});

describe("search request", () => {
  it("reads the host's request to open the element search", () => {
    expect(readEmbedMessage({ type: SEARCH })).toEqual({ type: SEARCH });
    expect(readEmbedMessage({ type: PROBE })).toEqual({ type: PROBE });
  });
});
