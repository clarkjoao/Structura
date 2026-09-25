import { describe, expect, it } from "vitest";
import type { Component, ShardComponent } from "../model/component.types";
import {
  hasShardRouter,
  keySpaceSegments,
  replicaMarks,
  shardCount,
  shardsOf,
} from "./sharded-store";

const shard = (id: string, extra: Partial<ShardComponent> = {}): ShardComponent =>
  ({
    id,
    name: id,
    description: "",
    parentId: "store",
    type: "deploy-shard",
    ...extra,
  }) as ShardComponent;

const components = (): Record<string, Component> => ({
  store: {
    id: "store",
    name: "Pedidos",
    description: "",
    parentId: null,
    type: "deploy-sharded-store",
  } as Component,
  "shard-2": shard("shard-2"),
  "shard-1": shard("shard-1"),
  router: {
    id: "router",
    name: "mongos",
    description: "",
    parentId: "store",
    type: "deploy-shard-router",
  } as Component,
  other: shard("other", { parentId: "elsewhere" }),
});

describe("shardsOf / shardCount", () => {
  it("counts only the store's own shard children", () => {
    expect(shardCount("store", components())).toBe(2);
    expect(shardCount("elsewhere", components())).toBe(1);
    expect(shardCount("nobody", components())).toBe(0);
  });

  it("orders shards left to right, then by name", () => {
    expect(shardsOf("store", components()).map((s) => s.id)).toEqual(["shard-1", "shard-2"]);
    const layouts = {
      "shard-1": { elementId: "shard-1", x: 300, y: 0 },
      "shard-2": { elementId: "shard-2", x: 10, y: 0 },
    };
    expect(shardsOf("store", components(), layouts).map((s) => s.id)).toEqual([
      "shard-2",
      "shard-1",
    ]);
  });

  it("knows whether the store has its router", () => {
    expect(hasShardRouter("store", components())).toBe(true);
    expect(hasShardRouter("elsewhere", components())).toBe(false);
  });
});

describe("keySpaceSegments", () => {
  const four = [shard("a"), shard("b", { hot: true }), shard("c"), shard("d")];

  it("splits a hash space evenly and alternates emphasis", () => {
    const segments = keySpaceSegments("hash", four);
    expect(segments.map((s) => s.share)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(segments.map((s) => s.emphasis)).toEqual(["light", "strong", "light", "strong"]);
    expect(segments.map((s) => s.hot)).toEqual([false, true, false, false]);
  });

  it("sizes a range strategy by each shard's share", () => {
    const segments = keySpaceSegments("range", [
      shard("a", { share: 1 }),
      shard("b", { share: 3 }),
    ]);
    expect(segments.map((s) => s.share)).toEqual([0.25, 0.75]);
  });

  it("treats a missing share as 1 and a negative one as nothing", () => {
    const segments = keySpaceSegments("range", [shard("a"), shard("b", { share: -2 })]);
    expect(segments.map((s) => s.share)).toEqual([1, 0]);
  });

  it("falls back to even fractions when every share is zero", () => {
    const segments = keySpaceSegments("range", [
      shard("a", { share: 0 }),
      shard("b", { share: 0 }),
    ]);
    expect(segments.map((s) => s.share)).toEqual([0.5, 0.5]);
  });

  it("ignores share outside a range strategy", () => {
    const segments = keySpaceSegments("geo", [shard("a", { share: 9 }), shard("b")]);
    expect(segments.map((s) => s.share)).toEqual([0.5, 0.5]);
  });

  it("labels a segment with the shard's range, or its name", () => {
    const segments = keySpaceSegments("geo", [shard("a", { keyRange: "BR" }), shard("b")]);
    expect(segments.map((s) => s.label)).toEqual(["BR", "b"]);
  });

  it("is empty without shards", () => {
    expect(keySpaceSegments("hash", [])).toEqual([]);
  });
});

describe("replicaMarks", () => {
  it("is one primary and RF − 1 replicas", () => {
    expect(replicaMarks(3)).toEqual({ primary: 1, replicas: 2 });
    expect(replicaMarks(1)).toEqual({ primary: 1, replicas: 0 });
  });

  it("reads a missing, fractional or silly factor sensibly", () => {
    expect(replicaMarks(undefined)).toEqual({ primary: 1, replicas: 0 });
    expect(replicaMarks(2.7)).toEqual({ primary: 1, replicas: 1 });
    expect(replicaMarks(0)).toEqual({ primary: 1, replicas: 0 });
    expect(replicaMarks(Number.NaN)).toEqual({ primary: 1, replicas: 0 });
  });
});
