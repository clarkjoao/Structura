import { describe, expect, it } from "vitest";
import { EdgeStyle } from "../enums";
import type { Component, Connection } from "../model/diagram.types";
import { computeImpact } from "./impact-analysis";

function node(id: string, name: string): Component {
  return {
    id,
    name,
    type: "system",
    description: "",
    tags: [],
    technology: "",
  } as Component;
}

function edge(id: string, sourceId: string, targetId: string, label = ""): Connection {
  return {
    id,
    sourceId,
    targetId,
    label,
    style: { edgeStyle: EdgeStyle.Smoothstep },
  };
}

describe("computeImpact", () => {
  it("returns empty impact when the node has no dependents", () => {
    const components = { a: node("a", "A") };
    const connections: Record<string, Connection> = {};
    const result = computeImpact("a", components, connections);
    expect(result.directDependents).toEqual([]);
    expect(result.transitiveDependents).toEqual([]);
    expect(result.brokenConnections).toEqual([]);
  });

  it("lists one direct dependent", () => {
    const components = {
      a: node("a", "A"),
      b: node("b", "B"),
    };
    const connections: Record<string, Connection> = {
      e1: edge("e1", "a", "b"),
    };
    const result = computeImpact("b", components, connections);
    expect(result.directDependents.map((c) => c.id)).toEqual(["a"]);
    expect(result.transitiveDependents).toEqual([]);
    expect(result.brokenConnections.map((c) => c.id)).toEqual(["e1"]);
  });

  it("separates direct and transitive dependents along a chain", () => {
    const components = {
      a: node("a", "A"),
      b: node("b", "B"),
      c: node("c", "C"),
    };
    const connections: Record<string, Connection> = {
      e1: edge("e1", "a", "b"),
      e2: edge("e2", "b", "c"),
    };
    const result = computeImpact("c", components, connections);
    expect(result.directDependents.map((c) => c.id)).toEqual(["b"]);
    expect(result.transitiveDependents.map((c) => c.id)).toEqual(["a"]);
  });

  it("terminates on cyclic reverse reachability", () => {
    const components = {
      a: node("a", "A"),
      b: node("b", "B"),
    };
    const connections: Record<string, Connection> = {
      e1: edge("e1", "a", "b"),
      e2: edge("e2", "b", "a"),
    };
    const result = computeImpact("b", components, connections);
    expect(result.directDependents.map((c) => c.id).sort()).toEqual(["a"]);
    expect(result.transitiveDependents).toEqual([]);
  });

  it("returns empty result for unknown node id", () => {
    const components = { a: node("a", "A") };
    const connections: Record<string, Connection> = {};
    expect(computeImpact("missing", components, connections).directDependents).toEqual([]);
  });

  it("includes incoming and outgoing edges in brokenConnections", () => {
    const components = {
      a: node("a", "A"),
      b: node("b", "B"),
      c: node("c", "C"),
    };
    const connections: Record<string, Connection> = {
      in: edge("in", "a", "b"),
      out: edge("out", "b", "c"),
    };
    const result = computeImpact("b", components, connections);
    expect(result.brokenConnections.map((c) => c.id).sort()).toEqual(["in", "out"]);
  });
});
