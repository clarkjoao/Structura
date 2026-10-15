import { describe, expect, it } from "vitest";
import type { Component, NodeLayout } from "../model/diagram.types";
import { placedComponents } from "./placement";

const component = (id: string, type: string) =>
  ({ id, name: id, description: "", parentId: null, type }) as Component;
const layout = (id: string) => ({ elementId: id, x: 0, y: 0 }) as NodeLayout;

const components = {
  a: component("a", "container"),
  t: component("t", "text"),
  unplaced: component("unplaced", "container"),
};
const layouts = { a: layout("a"), t: layout("t") };

describe("placedComponents and the text layer", () => {
  it("leaves texts out unless the layer is on", () => {
    expect(placedComponents(components, layouts).map((c) => c.id)).toEqual(["a"]);
    expect(placedComponents(components, layouts, { textsVisible: false }).map((c) => c.id)).toEqual(
      ["a"],
    );
  });

  it("draws them when the layer is on", () => {
    expect(placedComponents(components, layouts, { textsVisible: true }).map((c) => c.id)).toEqual([
      "a",
      "t",
    ]);
  });

  it("still requires a layout", () => {
    expect(placedComponents(components, {}, { textsVisible: true })).toEqual([]);
  });
});
