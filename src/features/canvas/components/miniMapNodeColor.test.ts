import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { Component } from "@/features/diagram";
import { makeMiniMapNodeColor } from "./miniMapNodeColor";

function component(id: string, type: string): Component {
  return { id, name: id, description: "", parentId: null, type } as Component;
}

const rfNode = (id: string) => ({ id }) as Node;

describe("makeMiniMapNodeColor", () => {
  it("colors C4 nodes from their palette token", () => {
    const color = makeMiniMapNodeColor({ a: component("a", "container") });

    expect(color(rfNode("a"))).toBe("hsl(var(--node-container))");
  });

  it("colors a cloud node from its category token", () => {
    const color = makeMiniMapNodeColor({ a: component("a", "aws-storage") });

    expect(color(rfNode("a"))).toBe("hsl(var(--aws-storage))");
  });

  it("uses the surface token for group shapes", () => {
    const color = makeMiniMapNodeColor({ a: component("a", "panel") });

    expect(color(rfNode("a"))).toBe("hsl(var(--border))");
  });

  it("falls back to neutral for a plugin type with no palette entry", () => {
    const color = makeMiniMapNodeColor({ a: component("a", "acme/widget") });

    expect(color(rfNode("a"))).toBe("hsl(var(--muted-foreground))");
  });

  it("falls back to neutral for a node with no matching component", () => {
    const color = makeMiniMapNodeColor({});

    expect(color(rfNode("ghost"))).toBe("hsl(var(--muted-foreground))");
  });
});
