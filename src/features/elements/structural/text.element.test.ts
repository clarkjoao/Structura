import { describe, expect, it } from "vitest";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import { getElement } from "@/features/elements/element.registry";
import { fromDiagram } from "@/features/canvas/layout/fromDiagram";
import type { Component } from "@/features/diagram";

describe("text", () => {
  const descriptor = getElement("text")!;
  const base = { id: "t", name: "Phase 1", description: "", parentId: null };

  it("is offered in the canvas palette", () => {
    const entries = paletteEntriesForCategory("canvas").filter((e) => e.type === "text");
    expect(entries.map((e) => e.key)).toEqual(["text"]);
  });

  it("is a decoration: no handles, no connections, may sit in a group", () => {
    expect(descriptor.canvas.handles).toEqual({ incoming: 0, outgoing: 0 });
    expect(descriptor.canvas.connectable).toBe(false);
    expect(descriptor.canvas.canBeConnectionSource).toBe(false);
    expect(descriptor.canvas.canHaveParent).toBe(true);
    expect(descriptor.canvas.canBeParent).toBe(false);
  });

  it("stores no style until the author picks one", () => {
    const created = descriptor.model.createComponent(base, {});
    expect(created).toMatchObject({ type: "text", name: "Phase 1" });
    expect(created).not.toHaveProperty("textSize");
    expect(created).not.toHaveProperty("bold");
  });

  it("keeps only the closed style keys patchable", () => {
    expect([...descriptor.model.patchableKeys].sort()).toEqual([
      "bold",
      "italic",
      "textColor",
      "textSize",
    ]);
  });
});

describe("text and autolayout", () => {
  const component = (id: string, type: string, parentId: string | null = null): Component =>
    ({ id, name: id, description: "", parentId, type }) as Component;

  it("leaves text out of the layout graph, in a diagram and inside a group", () => {
    const components = Object.fromEntries(
      [
        component("g", "panel"),
        component("a", "container", "g"),
        component("note-in-group", "text", "g"),
        component("loose", "text"),
      ].map((c) => [c.id, c]),
    );

    const whole = fromDiagram(components, [], {});
    expect(whole.nodes.map((n) => n.id).sort()).toEqual(["a", "g"]);

    const scoped = fromDiagram(components, [], {}, { rootIds: ["g"] });
    expect(scoped.nodes.map((n) => n.id).sort()).toEqual(["a", "g"]);
  });
});
