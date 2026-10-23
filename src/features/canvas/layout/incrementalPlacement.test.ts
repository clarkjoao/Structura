import { describe, expect, it } from "vitest";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { dirtyAfterEdit, placeIncrementally } from "./incrementalPlacement";

const component = (
  id: string,
  parentId: string | null = null,
  type: Component["type"] = "container",
): Component => ({ id, name: id, description: "", parentId, type }) as Component;

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

const at = (elementId: string, x: number, y: number, width = 200, height = 80): NodeLayout => ({
  elementId,
  x,
  y,
  width,
  height,
});

function records<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((item) => [item.id, item]));
}

const GAPS = { columnGap: 220, rowGap: 40 };

describe("placeIncrementally", () => {
  it("puts a new target one column right of its source, on the same row", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("new")]),
      connections: records([connection("c", "a", "new")]),
      nodeLayouts: { a: at("a", 100, 100), new: at("new", 900, 900) },
      dirtyIds: ["new"],
      ...GAPS,
    });

    expect(placed).toEqual([{ elementId: "new", x: 100 + 200 + 220, y: 100 }]);
  });

  it("puts a new source one column left of its target", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("new")]),
      connections: records([connection("c", "new", "a")]),
      nodeLayouts: { a: at("a", 1000, 100), new: at("new", 0, 0) },
      dirtyIds: ["new"],
      ...GAPS,
    });

    expect(placed).toEqual([{ elementId: "new", x: 1000 - 220 - 200, y: 100 }]);
  });

  it("never moves anything that is not dirty", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("b"), component("new")]),
      connections: records([connection("ab", "a", "b"), connection("an", "a", "new")]),
      nodeLayouts: { a: at("a", 0, 0), b: at("b", 420, 0), new: at("new", 5, 5) },
      dirtyIds: ["new"],
      ...GAPS,
    });

    expect(placed.map((p) => p.elementId)).toEqual(["new"]);
  });

  it("slides down past whatever already sits in that spot", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("b"), component("new")]),
      connections: records([connection("ab", "a", "b"), connection("an", "a", "new")]),
      // `b` already occupies the column right of `a`.
      nodeLayouts: { a: at("a", 0, 0), b: at("b", 420, 0), new: at("new", 5, 5) },
      dirtyIds: ["new"],
      ...GAPS,
    });

    expect(placed[0]).toEqual({ elementId: "new", x: 420, y: 80 + 40 });
  });

  it("stacks several new targets of one source instead of piling them up", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("n1"), component("n2")]),
      connections: records([connection("c1", "a", "n1"), connection("c2", "a", "n2")]),
      nodeLayouts: { a: at("a", 0, 0), n1: at("n1", 0, 0), n2: at("n2", 0, 0) },
      dirtyIds: ["n1", "n2"],
      ...GAPS,
    });

    const byId = Object.fromEntries(placed.map((p) => [p.elementId, p]));
    expect(byId.n1).toEqual({ elementId: "n1", x: 420, y: 0 });
    expect(byId.n2).toEqual({ elementId: "n2", x: 420, y: 120 });
  });

  it("places a chain from the fixed side outwards", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("n1"), component("n2")]),
      connections: records([connection("c1", "a", "n1"), connection("c2", "n1", "n2")]),
      nodeLayouts: { a: at("a", 0, 0), n1: at("n1", 0, 500), n2: at("n2", 0, 500) },
      dirtyIds: ["n2", "n1"],
      ...GAPS,
    });

    const byId = Object.fromEntries(placed.map((p) => [p.elementId, p]));
    expect(byId.n1!.x).toBe(420);
    expect(byId.n2!.x).toBe(840);
  });

  it("leaves an element with nothing to sit next to where it was put", () => {
    const placed = placeIncrementally({
      components: records([component("a"), component("lonely")]),
      connections: {},
      nodeLayouts: { a: at("a", 0, 0), lonely: at("lonely", 700, 300) },
      dirtyIds: ["lonely"],
      ...GAPS,
    });

    expect(placed).toEqual([]);
  });

  it("works in the container's coordinates for an element inside a panel", () => {
    const placed = placeIncrementally({
      components: records([
        component("p", null, "panel"),
        component("a", "p"),
        component("new", "p"),
      ]),
      connections: records([connection("c", "a", "new")]),
      nodeLayouts: {
        p: at("p", 1000, 1000, 900, 400),
        a: at("a", 40, 60),
        new: at("new", 40, 200),
      },
      dirtyIds: ["new"],
      ...GAPS,
    });

    expect(placed).toEqual([{ elementId: "new", x: 40 + 200 + 220, y: 60 }]);
  });
});

describe("placeIncrementally across containers", () => {
  it("does not spill over the panel's edge onto a neighbour panel's element", () => {
    const placed = placeIncrementally({
      components: records([
        component("p", null, "panel"),
        component("q", null, "panel"),
        component("a", "p"),
        component("other", "q"),
        component("new", "p"),
      ]),
      connections: records([connection("c", "a", "new")]),
      nodeLayouts: {
        p: at("p", 0, 0, 400, 200),
        q: at("q", 450, 0, 400, 200),
        a: at("a", 40, 60),
        other: at("other", 40, 60),
        new: at("new", 40, 60),
      },
      dirtyIds: ["new"],
      ...GAPS,
    });

    const node = placed.find((p) => p.elementId === "new")!;
    // Right of `a` is panel `q`: the element slides below it.
    expect(node.x).toBe(460);
    expect(node.y).toBeGreaterThanOrEqual(200);
  });

  it("grows the containers it lands in so it stays inside them", () => {
    const placed = placeIncrementally({
      components: records([
        component("p", null, "panel"),
        component("a", "p"),
        component("new", "p"),
      ]),
      connections: records([connection("c", "a", "new")]),
      nodeLayouts: { p: at("p", 100, 100, 400, 200), a: at("a", 40, 60), new: at("new", 40, 60) },
      dirtyIds: ["new"],
      ...GAPS,
    });

    expect(placed).toContainEqual({
      elementId: "p",
      x: 100,
      y: 100,
      width: 460 + 200 + 40,
      height: 200,
    });
  });
});

describe("dirtyAfterEdit", () => {
  const before = {
    components: records([component("a"), component("b"), component("lonely")]),
    connections: records([connection("ab", "a", "b")]),
  };

  it("marks what was added and what moved into another container", () => {
    const after = {
      components: records([
        component("a"),
        component("b", "p"),
        component("lonely"),
        component("p", null, "panel"),
        component("new"),
      ]),
      connections: before.connections,
    };
    expect(dirtyAfterEdit(before, after)).toEqual(["b", "new", "p"]);
  });

  it("marks an element that had no connection and just got its first", () => {
    const after = {
      components: before.components,
      connections: records([connection("ab", "a", "b"), connection("al", "a", "lonely")]),
    };
    expect(dirtyAfterEdit(before, after)).toEqual(["lonely"]);
  });

  it("puts the target after the source when both were on their own", () => {
    const loose = {
      components: records([component("x"), component("y")]),
      connections: {},
    };
    const after = {
      components: loose.components,
      connections: records([connection("xy", "x", "y")]),
    };
    expect(dirtyAfterEdit(loose, after)).toEqual(["y"]);
  });

  it("marks nothing for a connection between elements already in place, or a deletion", () => {
    const connected = {
      components: before.components,
      connections: records([connection("ab", "a", "b"), connection("ba", "b", "a")]),
    };
    expect(dirtyAfterEdit(before, connected)).toEqual([]);

    const deleted = {
      components: records([component("a"), component("b")]),
      connections: before.connections,
    };
    expect(dirtyAfterEdit(before, deleted)).toEqual([]);
  });
});
