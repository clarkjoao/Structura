import { describe, expect, it } from "vitest";
import { buildPreviewDiagram, PREVIEW_DIAGRAM_ID } from "./build-diagram";
import { LOAD_GRAPH, THEME, readEmbedMessage, type PreviewGraph } from "./protocol";

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
