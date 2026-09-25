import { describe, expect, it } from "vitest";
import type { Component } from "../model/component.types";
import type { Connection } from "../model/connection.types";
import {
  hideSharedEdges,
  refsOf,
  resolveShared,
  sharedMode,
  sharedUses,
  suggestsSharing,
  usageCount,
} from "./shared";

const c = (id: string, extra: Record<string, unknown> = {}): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "container",
    ...extra,
  }) as unknown as Component;
const ref = (id: string, refOf: string) => c(id, { type: "shared-ref", refOf });
const link = (id: string, sourceId: string, targetId: string, label = ""): Connection =>
  ({ id, sourceId, targetId, label }) as Connection;

const world = (mode?: string): Record<string, Component> => ({
  auth: c("auth", mode ? { shared: { mode } } : {}),
  a: c("a"),
  b: c("b"),
  d: c("d"),
  r1: ref("r1", "auth"),
  r2: ref("r2", "r1"),
});

describe("resolveShared", () => {
  it("follows references to the original, and leaves anything else alone", () => {
    const w = world();
    expect(resolveShared("r1", w)).toBe("auth");
    expect(resolveShared("r2", w)).toBe("auth");
    expect(resolveShared("a", w)).toBe("a");
    expect(resolveShared("ghost", w)).toBe("ghost");
  });

  it("a dangling or looping reference stands for itself", () => {
    expect(resolveShared("x", { x: ref("x", "gone") })).toBe("x");
    const loop = { x: ref("x", "y"), y: ref("y", "x") };
    expect(resolveShared("x", loop)).toBe("x");
  });

  it("refsOf finds references at any depth", () => {
    expect(refsOf("auth", world()).sort()).toEqual(["r1", "r2"]);
    expect(refsOf("a", world())).toEqual([]);
  });
});

describe("uses", () => {
  const connections = {
    e1: link("e1", "a", "auth", "gRPC"),
    e2: link("e2", "b", "r1", "HTTP"),
    e3: link("e3", "a", "r2", "gRPC"),
    e4: link("e4", "auth", "d", "events"),
    e5: link("e5", "r1", "auth", "self"),
  };

  it("counts every consumer once, through references, not the element itself", () => {
    const w = world();
    expect(sharedUses("auth", w, connections).map((u) => [u.consumerId, u.label])).toEqual([
      ["a", "gRPC"],
      ["b", "HTTP"],
      ["a", "gRPC"],
    ]);
    expect(usageCount("auth", w, connections)).toBe(2);
    expect(usageCount("d", w, connections)).toBe(1);
  });

  it("suggests sharing from four consumers, only while drawn with edges", () => {
    const many = {
      ...world(),
      e: c("e"),
      f: c("f"),
    };
    const four = {
      x1: link("x1", "a", "auth"),
      x2: link("x2", "b", "auth"),
      x3: link("x3", "d", "auth"),
      x4: link("x4", "e", "auth"),
    };
    expect(suggestsSharing("auth", many, four)).toBe(true);
    const { x4: _, ...three } = four;
    expect(suggestsSharing("auth", many, three)).toBe(false);
    expect(
      suggestsSharing("auth", { ...many, auth: c("auth", { shared: { mode: "badge" } }) }, four),
    ).toBe(false);
  });
});

describe("hideSharedEdges", () => {
  const edges = [link("e1", "a", "auth"), link("e2", "b", "r1"), link("e3", "auth", "d")];

  it("draws everything while the element is drawn with its edges", () => {
    expect(sharedMode(world().auth)).toBe("edges");
    expect(hideSharedEdges(edges, world())).toBe(edges);
  });

  it("badge: hides the edges straight into it, not those through a reference or out of it", () => {
    expect(hideSharedEdges(edges, world("badge")).map((e) => e.id)).toEqual(["e2", "e3"]);
  });

  it("shows a revealed connection, or every edge of a revealed element", () => {
    expect(hideSharedEdges(edges, world("badge"), { connections: new Set(["e1"]) })).toHaveLength(
      3,
    );
    expect(hideSharedEdges(edges, world("badge"), { originals: new Set(["auth"]) })).toHaveLength(
      3,
    );
    expect(hideSharedEdges(edges, world("badge"), { originals: new Set(["b"]) })).toHaveLength(2);
  });
});
