import { describe, expect, it } from "vitest";
import type { Component, Connection } from "@/features/diagram";
import { ancestorsOf, remapConnectionsToVisible, visibleAncestorOf } from "./compactView";

const node = (id: string, parentId: string | null = null): Component =>
  ({ id, name: id, description: "", parentId, type: "system" }) as Component;
const edge = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: id }) as Connection;

// cluster ⊃ namespace ⊃ workload; app outside.
const components: Record<string, Component> = {
  cluster: node("cluster"),
  ns: node("ns", "cluster"),
  wl: node("wl", "ns"),
  router: node("router", "cluster"),
  app: node("app"),
};

describe("visibleAncestorOf", () => {
  it("is the element itself when nothing around it is compact", () => {
    expect(visibleAncestorOf("wl", components, new Set())).toBe("wl");
  });

  it("is the compact parent", () => {
    expect(visibleAncestorOf("wl", components, new Set(["ns"]))).toBe("ns");
  });

  it("is the OUTERMOST compact ancestor, not the nearest", () => {
    // A compact namespace inside a compact cluster is itself hidden.
    expect(visibleAncestorOf("wl", components, new Set(["ns", "cluster"]))).toBe("cluster");
  });

  it("does not climb past an expanded outer container", () => {
    expect(visibleAncestorOf("wl", components, new Set(["ns"]))).not.toBe("cluster");
  });

  it("survives a parent cycle in bad data", () => {
    const cyclic = { a: node("a", "b"), b: node("b", "a") };
    expect(visibleAncestorOf("a", cyclic, new Set(["b"]))).toBe("b");
  });
});

describe("ancestorsOf", () => {
  it("lists the ancestors innermost first", () => {
    expect(ancestorsOf("wl", components)).toEqual(["ns", "cluster"]);
    expect(ancestorsOf("app", components)).toEqual([]);
  });
});

describe("remapConnectionsToVisible", () => {
  const connections = [
    edge("in", "app", "wl"),
    edge("inside", "router", "wl"),
    edge("plain", "app", "cluster"),
  ];

  it("returns the same array when nothing is compact", () => {
    expect(remapConnectionsToVisible(connections, components, new Set())).toBe(connections);
  });

  it("draws an edge into a hidden child on the compact container, keeping its id", () => {
    const drawn = remapConnectionsToVisible(connections, components, new Set(["cluster"]));
    expect(drawn.find((c) => c.id === "in")).toMatchObject({
      sourceId: "app",
      targetId: "cluster",
    });
  });

  it("drops an edge that would start and end on the same compact container", () => {
    const drawn = remapConnectionsToVisible(connections, components, new Set(["cluster"]));
    expect(drawn.map((c) => c.id)).not.toContain("inside");
  });

  it("keeps an untouched connection as the same object", () => {
    const drawn = remapConnectionsToVisible(connections, components, new Set(["ns"]));
    expect(drawn.find((c) => c.id === "plain")).toBe(connections[2]);
  });

  it("never changes the connections it was given", () => {
    const before = JSON.stringify(connections);
    remapConnectionsToVisible(connections, components, new Set(["cluster"]));
    expect(JSON.stringify(connections)).toBe(before);
  });
});
