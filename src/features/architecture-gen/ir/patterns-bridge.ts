/**
 * Pattern → IR bridge.
 *
 * Converts a pattern template into IR nodes and connections, replacing the pattern's positional
 * `fromIndex/toIndex` references with actual node IDs. This is what lets the model use a pattern
 * inside the proposal loop: the model calls `expand_pattern`, the bridge returns IR, the session
 * merges it, the layout engine materialises it.
 *
 * Usage from the model:
 * ```
 * expand_pattern({ pattern: "circuit-breaker", prefix: "payment-" })
 * ```
 *
 * The bridge generates new ids with the given prefix so the pattern can be merged into a
 * larger diagram without collision. To wire the pattern to surrounding nodes, pass
 * `wiring` to map component positions to external ids.
 */

import type { PatternTemplate } from "@/lib/catalogs/patterns";
import { PATTERNS } from "@/lib/catalogs/patterns";
import type { ArchitectureIr, IrNode, IrConnection } from "./schema";
import type { Tier } from "./schema";

export interface PatternExpandOptions {
  /** Prefix for all generated ids, e.g. "payment-". Avoids collisions when merging. */
  prefix?: string;
  /**
   * Wire the pattern's boundary nodes (index 0 and last) to external nodes.
   * Position 0 is treated as the entry/exit point.
   */
  wiring?: {
    /** External id that the pattern's entry node (index 0) receives an incoming edge from. */
    entrySource?: string;
    /** External id that the pattern's exit node (last index) sends an outgoing edge to. */
    exitTarget?: string;
  };
  /** Tier to assign to all pattern components. Defaults to "application". */
  tier?: Tier;
  /**
   * Map from pattern component index (0-based) to external node id.
   * When provided, those components are NOT emitted as new nodes — only connections
   * referencing them are generated. Use this to reuse existing nodes as pattern members.
   */
  reuseExisting?: Record<number, string>;
}

/** Result of expanding a pattern into IR terms. */
export interface PatternExpansion {
  pattern: PatternTemplate;
  /** New IR nodes (empty if reuseExisting covered all components). */
  nodes: IrNode[];
  /** New IR connections, including any wiring edges to external nodes. */
  connections: IrConnection[];
  /**
   * Maps component index -> node id (either generated or from reuseExisting).
   * Use this to understand what id each position maps to after expansion.
   */
  indexToId: Map<number, string>;
}

/**
 * Looks up a pattern by id (exact or fuzzy prefix match).
 * Returns the best match, or null if nothing is close enough.
 */
export function findPattern(query: string): PatternTemplate | null {
  const q = query.toLowerCase();

  // Exact match
  const exact = PATTERNS.find((p) => p.id === q);
  if (exact) return exact;

  // Prefix match on id
  const prefix = PATTERNS.filter((p) => p.id.startsWith(q));
  if (prefix.length === 1) return prefix[0]!;

  // Fuzzy: contains
  const fuzzy = PATTERNS.filter((p) => p.id.includes(q) || p.name.toLowerCase().includes(q));
  if (fuzzy.length === 1) return fuzzy[0]!;

  // No match
  return null;
}

/**
 * Expands a pattern into IR nodes and connections.
 *
 * Components at positions covered by `reuseExisting` are not emitted as new nodes — the
 * bridge generates connections that reference the existing external ids instead. This lets
 * a pattern describe a subgraph where some pieces are already on the canvas.
 */
export function expandPattern(
  pattern: PatternTemplate,
  options: PatternExpandOptions = {},
): PatternExpansion {
  const prefix = options.prefix ?? `${pattern.id}-`;
  const tier = options.tier ?? "application";
  const indexToId = new Map<number, string>();

  // Assign ids: reuse existing or generate
  for (let i = 0; i < pattern.components.length; i += 1) {
    if (options.reuseExisting && i in options.reuseExisting) {
      indexToId.set(i, options.reuseExisting[i]!);
    } else {
      indexToId.set(i, `${prefix}comp-${i}`);
    }
  }

  // Build nodes (only for positions not reused)
  const nodes: IrNode[] = [];
  for (let i = 0; i < pattern.components.length; i += 1) {
    if (options.reuseExisting && i in options.reuseExisting) continue;

    const comp = pattern.components[i]!;
    nodes.push({
      id: indexToId.get(i)!,
      type: comp.type,
      name: comp.name,
      technology: comp.technology,
      description: comp.description,
      aws_service: comp.awsService,
      tier,
    });
  }

  // Build connections
  const connections: IrConnection[] = [];

  // Internal connections from pattern
  for (const conn of pattern.connections) {
    const fromId = indexToId.get(conn.fromIndex);
    const toId = indexToId.get(conn.toIndex);
    if (!fromId || !toId) continue;

    connections.push({
      id: `${prefix}conn-${conn.fromIndex}-${conn.toIndex}`,
      from: fromId,
      to: toId,
      label: conn.label,
      intent: "call",
    });
  }

  // Wiring: entry source -> pattern entry node (index 0)
  if (options.wiring?.entrySource) {
    const entryId = indexToId.get(0);
    if (entryId) {
      connections.push({
        id: `${prefix}entry-edge`,
        from: options.wiring.entrySource,
        to: entryId,
        intent: "call",
      });
    }
  }

  // Wiring: pattern exit node (last) -> exit target
  if (options.wiring?.exitTarget) {
    const lastIndex = pattern.components.length - 1;
    const exitId = indexToId.get(lastIndex);
    if (exitId) {
      connections.push({
        id: `${prefix}exit-edge`,
        from: exitId,
        to: options.wiring.exitTarget,
        intent: "call",
      });
    }
  }

  return { pattern, nodes, connections, indexToId };
}

/**
 * Merges a pattern expansion into an existing IR.
 *
 * Returns a new IR with the pattern's nodes and connections appended. Id collisions are
 * avoided by the prefix mechanism in `expandPattern`.
 *
 * If `replace` is true, nodes and connections in the target IR whose ids match the
 * pattern's component ids are replaced; otherwise they are kept (the pattern adds to them).
 */
export function mergePatternIntoIr(
  target: ArchitectureIr,
  expansion: PatternExpansion,
  replace = false,
): ArchitectureIr {
  const existingNodeIds = new Set(target.nodes.map((n) => n.id));
  const existingConnIds = new Set((target.connections ?? []).map((c) => c.id));

  const newNodes = [...target.nodes];
  for (const node of expansion.nodes) {
    const idx = newNodes.findIndex((n) => n.id === node.id);
    if (replace && idx >= 0) {
      newNodes[idx] = node;
    } else if (!existingNodeIds.has(node.id)) {
      newNodes.push(node);
    }
  }

  const newConnections = [...(target.connections ?? [])];
  for (const conn of expansion.connections) {
    const idx = newConnections.findIndex((c) => c.id === conn.id);
    if (replace && idx >= 0) {
      newConnections[idx] = conn;
    } else if (!existingConnIds.has(conn.id)) {
      newConnections.push(conn);
    }
  }

  return {
    ...target,
    nodes: newNodes,
    connections: newConnections,
  };
}

/** Returns the pattern id list and categories for the model's reference. */
export function listPatterns(): {
  id: string;
  name: string;
  description: string;
  category: string;
  componentCount: number;
}[] {
  return PATTERNS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description.split(".")[0]!, // first sentence
    category: p.category,
    componentCount: p.components.length,
  }));
}
