import { describe, expect, it } from "vitest";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import type { LayoutBox, LayoutGraph, LayoutResult } from "./contract";
import { placeIncrementally } from "./incrementalPlacement";
import { layout, layoutElkGraph } from "./layoutEngine";
import { measureReadability } from "./layoutReadability";
import { REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * Automatic-mode stability experiment. Measurement only.
 *
 * The question: when the author adds one element to an arranged diagram, how
 * much of what was already there moves? Three strategies:
 *   - `full`: today's automatic run, a fresh layout of everything.
 *   - `interactive`: the same, with every existing node's current position
 *     handed to ELK and its interactive strategies keeping that order.
 *   - `incremental`: `placeIncrementally`, what the automatic mode ships —
 *     nothing existing moves; the new element goes one column after the
 *     element it connects from and slides down until it overlaps nothing.
 *
 *   npx vitest run autoArrangeStability.experiment --silent=false
 */

const INTERACTIVE: Record<string, string> = {
  "elk.layered.layering.strategy": "INTERACTIVE",
  "elk.layered.crossingMinimization.strategy": "INTERACTIVE",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
  "elk.layered.cycleBreaking.strategy": "INTERACTIVE",
};

const SEMI_INTERACTIVE: Record<string, string> = {
  "elk.layered.crossingMinimization.semiInteractive": "true",
};

const NEW_ID = "__new__";
const MOVED_PX = 20;

function withNewNode(graph: LayoutGraph, sourceId: string): LayoutGraph {
  const source = graph.nodes.find((node) => node.id === sourceId)!;
  return {
    nodes: [...graph.nodes, { id: NEW_ID, parentId: source.parentId, width: 200, height: 80 }],
    edges: [...graph.edges, { id: "__new_edge__", sourceId, targetId: NEW_ID }],
  };
}

/** Absolute boxes: positions are parent-relative in the result. */
function absolute(graph: LayoutGraph, result: LayoutResult): Map<string, LayoutBox> {
  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parentId]));
  const out = new Map<string, LayoutBox>();
  const resolve = (id: string): LayoutBox | undefined => {
    const hit = out.get(id);
    if (hit) return hit;
    const box = result.boxes.get(id);
    if (!box) return undefined;
    const parentId = parentOf.get(id);
    const parent = parentId ? resolve(parentId) : undefined;
    const abs = { ...box, x: box.x + (parent?.x ?? 0), y: box.y + (parent?.y ?? 0) };
    out.set(id, abs);
    return abs;
  };
  for (const node of graph.nodes) resolve(node.id);
  return out;
}

interface Movement {
  moved: number;
  meanShift: number;
}

function movement(
  before: Map<string, LayoutBox>,
  after: Map<string, LayoutBox>,
  leaves: Set<string>,
): Movement {
  // Discount a uniform shift of the whole picture: the median displacement is
  // treated as a pan, so only elements that changed place relative to the rest count.
  const dxs: number[] = [];
  const dys: number[] = [];
  for (const id of leaves) {
    const a = before.get(id);
    const b = after.get(id);
    if (a && b) {
      dxs.push(b.x - a.x);
      dys.push(b.y - a.y);
    }
  }
  const median = (values: number[]) =>
    [...values].sort((p, q) => p - q)[Math.floor(values.length / 2)] ?? 0;
  const panX = median(dxs);
  const panY = median(dys);
  let moved = 0;
  let total = 0;
  for (const id of leaves) {
    const a = before.get(id);
    const b = after.get(id);
    if (!a || !b) continue;
    const shift = Math.hypot(b.x - a.x - panX, b.y - a.y - panY);
    total += shift;
    if (shift > MOVED_PX) moved += 1;
  }
  return { moved, meanShift: Math.round(total / leaves.size) };
}

function overlaps(boxes: Map<string, LayoutBox>, id: string, leaves: Set<string>): number {
  const box = boxes.get(id)!;
  let count = 0;
  for (const other of leaves) {
    const o = boxes.get(other);
    if (!o || other === id) continue;
    if (
      box.x < o.x + o.width &&
      o.x < box.x + box.width &&
      box.y < o.y + o.height &&
      o.y < box.y + box.height
    ) {
      count += 1;
    }
  }
  return count;
}

describe("automatic-mode stability", () => {
  it("measures how much an insert moves the existing elements", async () => {
    const rows: string[] = [];
    const sums = {
      full: [0, 0, 0],
      interactive: [0, 0, 0],
      semi: [0, 0, 0],
      incremental: [0, 0, 0],
    };
    let cases = 0;

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = irToLayoutGraph(ir);
      const base = await layout(graph);
      const baseAbs = absolute(graph, base);
      const parents = new Set(graph.nodes.map((n) => n.parentId).filter(Boolean));
      const leaves = new Set(graph.nodes.filter((n) => !parents.has(n.id)).map((n) => n.id));
      // Four insert points per diagram, spread over the sorted leaves.
      const sorted = [...leaves].sort();
      const sources = [0, 1, 2, 3].map((i) => sorted[Math.floor((i * sorted.length) / 4)]!);

      for (const sourceId of sources) {
        cases += 1;
        const grown = withNewNode(graph, sourceId);
        const withPositions: LayoutGraph = {
          ...grown,
          nodes: grown.nodes.map((node) => {
            const box = base.boxes.get(node.id);
            if (box) return { ...node, position: { x: box.x, y: box.y } };
            const source = base.boxes.get(sourceId)!;
            return { ...node, position: { x: source.x + source.width + 60, y: source.y } };
          }),
        };

        const full = await layout(grown);
        const interactive = await layout(withPositions, INTERACTIVE);
        const semi = await layout(withPositions, SEMI_INTERACTIVE);

        const fullAbs = absolute(grown, full);
        // Incremental: what the automatic mode ships (`placeIncrementally`).
        const components: Record<string, Component> = {};
        const nodeLayouts: Record<string, NodeLayout> = {};
        const sizes = new Map<string, { width: number; height: number }>();
        const parentIds = new Set(grown.nodes.map((n) => n.parentId).filter(Boolean));
        for (const node of grown.nodes) {
          const type = parentIds.has(node.id) ? "panel" : "container";
          components[node.id] = {
            id: node.id,
            name: node.id,
            description: "",
            parentId: node.parentId,
            type,
          } as Component;
          const box = base.boxes.get(node.id) ?? base.boxes.get(sourceId)!;
          nodeLayouts[node.id] = { elementId: node.id, x: box.x, y: box.y };
          sizes.set(node.id, base.boxes.get(node.id) ?? { width: node.width, height: node.height });
        }
        const connections: Record<string, Connection> = Object.fromEntries(
          grown.edges.map((e) => [
            e.id,
            { id: e.id, sourceId: e.sourceId, targetId: e.targetId, label: "" } as Connection,
          ]),
        );
        const placements = placeIncrementally({
          components,
          connections,
          nodeLayouts,
          measured: sizes,
          dirtyIds: [NEW_ID],
          columnGap: 220,
          rowGap: 55,
        });
        const placement = placements.find((p) => p.elementId === NEW_ID);
        const placedLayouts: Record<string, NodeLayout> = {
          ...nodeLayouts,
          [NEW_ID]: { elementId: NEW_ID, x: placement!.x, y: placement!.y },
        };
        const incrementalResult: LayoutResult = {
          ...base,
          boxes: new Map(
            grown.nodes.map((n) => [n.id, { ...placedLayouts[n.id]!, ...sizes.get(n.id)! }]),
          ),
        };
        const incrementalAbs = absolute(grown, incrementalResult);

        const measure = (
          label: keyof typeof sums,
          abs: Map<string, LayoutBox>,
          crossings: number,
        ) => {
          const m = movement(baseAbs, abs, leaves);
          const o = overlaps(abs, NEW_ID, leaves);
          sums[label][0] += m.moved;
          sums[label][1] += o;
          sums[label][2] += crossings;
          return `${label}: moved ${m.moved}/${leaves.size} (mean ${m.meanShift}px) overlaps ${o} crossings ${crossings}`;
        };
        const crossingsOf = async (g: LayoutGraph, overrides: Record<string, string>) =>
          measureReadability(await layoutElkGraph(g, overrides)).edgeCrossings;

        rows.push(
          `${name} +${sourceId}\n  ${measure("full", fullAbs, await crossingsOf(grown, {}))}\n  ${measure(
            "interactive",
            absolute(withPositions, interactive),
            await crossingsOf(withPositions, INTERACTIVE),
          )}\n  ${measure("semi", absolute(withPositions, semi), await crossingsOf(withPositions, SEMI_INTERACTIVE))}\n  ${measure(
            "incremental",
            incrementalAbs,
            Number.NaN,
          )}`,
        );
      }
    }

    process.stdout.write(rows.join("\n") + "\n");
    process.stdout.write(
      Object.entries(sums)
        .map(
          ([label, [moved, over, cross]]) =>
            `${label}: moved ${moved}, new-node overlaps ${over}, crossings ${cross} over ${cases} inserts`,
        )
        .join("\n") + "\n",
    );
    expect(cases).toBeGreaterThan(0);
  }, 120_000);
});
