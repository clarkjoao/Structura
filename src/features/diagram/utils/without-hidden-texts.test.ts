import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "../model/diagram.types";
import { withoutHiddenTexts } from "./without-hidden-texts";

const component = (id: string, type: string) =>
  ({ id, name: id, description: "", parentId: null, type }) as Component;
const layout = (id: string) => ({ elementId: id, x: 0, y: 0 });

function diagram(textsVisible?: boolean): Diagram {
  return {
    id: "d",
    name: "d",
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components: { a: component("a", "container"), t: component("t", "text") },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { a: layout("a"), t: layout("t") },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    versions: {
      s: {
        id: "s",
        name: "scene",
        color: "#000",
        createdAt: 1,
        addedComponents: { st: component("st", "text"), sa: component("sa", "container") },
        addedConnections: {},
        removedComponentIds: [],
        removedConnectionIds: [],
        nodeLayouts: { st: layout("st"), sa: layout("sa") },
      },
    },
    ...(textsVisible === undefined ? {} : { textsVisible }),
  } as Diagram;
}

describe("withoutHiddenTexts", () => {
  it("drops the texts, their layouts and the scenes' texts while the layer is off", () => {
    const out = withoutHiddenTexts(diagram());
    expect(Object.keys(out.snapshot.components)).toEqual(["a"]);
    expect(Object.keys(out.nodeLayouts)).toEqual(["a"]);
    expect(Object.keys(out.versions!.s.addedComponents)).toEqual(["sa"]);
    expect(Object.keys(out.versions!.s.nodeLayouts)).toEqual(["sa"]);
  });

  it("treats an explicit false the same as absent", () => {
    expect(Object.keys(withoutHiddenTexts(diagram(false)).snapshot.components)).toEqual(["a"]);
  });

  it("returns the diagram itself when the layer is on", () => {
    const on = diagram(true);
    expect(withoutHiddenTexts(on)).toBe(on);
  });

  it("returns the diagram itself when there is no text to drop", () => {
    const plain = diagram();
    delete plain.snapshot.components.t;
    delete plain.versions!.s.addedComponents.st;
    expect(withoutHiddenTexts(plain)).toBe(plain);
  });

  it("does not mutate its input", () => {
    const input = diagram();
    withoutHiddenTexts(input);
    expect(Object.keys(input.snapshot.components)).toEqual(["a", "t"]);
  });
});
