import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { diagramToExportModel } from "./to-export-model";

/**
 * The draw.io export attaches every edge where the canvas draws it for the
 * diagram's reading direction (ADR-0013): bottom out and top in for a
 * top-to-bottom diagram, slot offsets spread along the side.
 */

const system = (id: string): Component =>
  ({ id, name: id, description: "", parentId: null, type: "system" }) as Component;
const decision = (id: string): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "process-node",
    flowShape: "diamond",
  }) as Component;

function diagram(components: Component[], connections: Connection[], direction?: "TB"): Diagram {
  return {
    id: "d",
    name: "d",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: Object.fromEntries(connections.map((c) => [c.id, c])),
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: Object.fromEntries(
      components.map((c, i) => [
        c.id,
        { elementId: c.id, x: 0, y: i * 300, width: 200, height: 100 },
      ]),
    ),
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...(direction && { direction }),
  };
}

const edge = (id: string, sourceId: string, targetId: string, extra: Partial<Connection> = {}) =>
  ({ id, sourceId, targetId, label: "", ...extra }) as Connection;

describe("draw.io export by reading direction", () => {
  it("leaves the bottom and enters the top of a vertical diagram", () => {
    const model = diagramToExportModel(
      diagram([system("a"), system("b")], [edge("ab", "a", "b")], "TB"),
      {},
    );
    expect(model.edges[0]).toMatchObject({ exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 });
  });

  it("spreads several outputs along the bottom side", () => {
    const model = diagramToExportModel(
      diagram(
        [system("a"), system("b"), system("c")],
        [edge("ab", "a", "b"), edge("ac", "a", "c")],
        "TB",
      ),
      {},
    );
    const exits = model.edges.map((e) => e.exitX);
    expect(new Set(exits).size).toBe(2);
    for (const e of model.edges) expect(e.exitY).toBe(1);
  });

  it("takes the cross axis, right out and left in, when the edge asks for it", () => {
    const model = diagramToExportModel(
      diagram(
        [decision("d"), decision("e")],
        [edge("de", "d", "e", { sourceSide: "right", targetSide: "left" })],
        "TB",
      ),
      {},
    );
    expect(model.edges[0]).toMatchObject({ exitX: 1, exitY: 0.5, entryX: 0 });
  });

  it("keeps a left-to-right diagram on the right and the left", () => {
    const model = diagramToExportModel(
      diagram([system("a"), system("b")], [edge("ab", "a", "b")]),
      {},
    );
    expect(model.edges[0]).toMatchObject({ exitX: 1, entryX: 0, entryY: 0.5 });
  });
});
