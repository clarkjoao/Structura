import type { Component, ShardComponent, ShardStrategy } from "../model/component.types";
import type { NodeLayout } from "../model/layout.types";
import { isShardComponent, isShardRouterComponent } from "../model/component.guards";

/*
 * What a sharded store shows of its shards, derived — never stored. The
 * number of shards is the number of shard children; the key-space bar is
 * drawn from them; a shard's replicas come from the store's factor.
 */

export const DEFAULT_SHARD_STRATEGY: ShardStrategy = "hash";

/**
 * The store's shards in the order the key bar lists them: left to right as
 * they sit in the store, then by name. Only direct children that are shards.
 */
export function shardsOf(
  storeId: string,
  components: Record<string, Component>,
  layouts: Record<string, NodeLayout> = {},
): ShardComponent[] {
  const shards: ShardComponent[] = [];
  for (const component of Object.values(components)) {
    if (component.parentId === storeId && isShardComponent(component)) shards.push(component);
  }
  return shards.sort((a, b) => {
    const ax = layouts[a.id]?.x ?? 0;
    const bx = layouts[b.id]?.x ?? 0;
    if (ax !== bx) return ax - bx;
    return a.name.localeCompare(b.name);
  });
}

/** How many shards the store has: its shard children, counted. */
export function shardCount(storeId: string, components: Record<string, Component>): number {
  let count = 0;
  for (const component of Object.values(components)) {
    if (component.parentId === storeId && isShardComponent(component)) count += 1;
  }
  return count;
}

/** Whether the store already has its one router. */
export function hasShardRouter(storeId: string, components: Record<string, Component>): boolean {
  return Object.values(components).some(
    (component) => component.parentId === storeId && isShardRouterComponent(component),
  );
}

/** One segment of the key-space bar (a representation, not a node). */
export interface KeySpaceSegment {
  shardId: string;
  label: string;
  /** Fraction of the bar, 0–1; the fractions add up to 1. */
  share: number;
  hot: boolean;
  /** Alternating emphasis, so neighbouring segments read apart. */
  emphasis: "light" | "strong";
}

/**
 * The key-space bar for a strategy. Hash and consistent hashing split the
 * space evenly (consistent hashing is drawn as a ring, but the arcs are the
 * same fractions); a range strategy sizes each shard by its `share`; geo and
 * directory are even, named segments.
 */
export function keySpaceSegments(
  strategy: ShardStrategy,
  shards: readonly ShardComponent[],
): KeySpaceSegment[] {
  if (shards.length === 0) return [];
  const weights = shards.map((shard) =>
    strategy === "range" ? Math.max(0, validNumber(shard.share) ?? 1) : 1,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return shards.map((shard, index) => ({
    shardId: shard.id,
    label: segmentLabel(strategy, shard),
    share: total > 0 ? weights[index] / total : 1 / shards.length,
    hot: shard.hot === true,
    emphasis: index % 2 === 0 ? "light" : "strong",
  }));
}

function segmentLabel(strategy: ShardStrategy, shard: ShardComponent): string {
  if (strategy === "geo" || strategy === "directory") return shard.keyRange || shard.name;
  return shard.keyRange || shard.name;
}

function validNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * A shard's copies from the store's replication factor: one primary and the
 * rest replicas. A missing or silly factor reads as a single copy.
 */
export function replicaMarks(replicationFactor: number | undefined): {
  primary: 1;
  replicas: number;
} {
  const factor = Math.floor(validNumber(replicationFactor) ?? 1);
  return { primary: 1, replicas: Math.max(0, factor - 1) };
}
