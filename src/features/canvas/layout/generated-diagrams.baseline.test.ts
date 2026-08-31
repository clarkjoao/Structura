import { describe, expect, it } from "vitest";
import { validateIR } from "@/features/llm/ir/ir-validator";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { layoutElkGraph } from "./layoutEngine";
import { readElkHandleOrder } from "./elkHandleOrder";
import { measureRenderedReadability } from "./renderedEdgePath";
import { measureReadability, readLaidOutGraph } from "./layoutReadability";
import { labelsOf } from "./reference-diagrams";
import { GENERATED_DIAGRAMS } from "./generated-diagrams";
import type { DiagramIR } from "@/features/llm/ir/ir.types";

/**
 * Six real model outputs at ~40 nodes, measured through the production path.
 *
 * `layoutReadability.baseline.test.ts` next door measures four reconstructions,
 * all of them small and tidy. These are captures, and they are the only fixtures
 * in the repo at the size where the layout actually struggles.
 *
 * **The numbers are exact, not upper bounds.** That is the point of freezing the
 * input: with the IR fixed, `irToLayoutGraph → layoutElkGraph →
 * readElkHandleOrder → measureRenderedReadability` is deterministic, so any move
 * is a change in the layout and nothing else. An upper bound would let a layout
 * change that improves one diagram and wrecks another read as green.
 *
 * What the exactness does and does not buy, measured rather than assumed
 * (`docs/fatia2-arestas-container/measure-id-sensitivity-frozen.json`): the
 * layout is insensitive to the *value* of an id — swapping one for another, or
 * prefixing all of them, moves nothing — and sensitive to their relative *order*,
 * where a full permutation moves A-run1 from 10 rendered crossings to 5 and
 * B-run1 from 23 to 11. So these numbers reproduce because the fixtures are
 * frozen literals in declaration order, not because any single id is special.
 *
 * Every number below reproduces the number the same run measured in the real
 * browser in Fatia 1 (`docs/fatia1-transporte/{A,B}-run{1,2,3}.measure.json`),
 * to the unit. That agreement is what licenses using these fixtures instead of
 * driving Chrome for every layout question.
 */

interface Expected {
  nodes: number;
  edges: number;
  /** IR edges whose source or target is a node that has children. */
  containerEdges: number;
  elkCrossings: number;
  renderedCrossings: number;
  elkEdgeNodeOverlaps: number;
  renderedEdgeNodeOverlaps: number;
  maxNestingDepth: number;
}

/**
 * Measured 2026-08-28 on this file's fixtures, `--retry=0`.
 *
 * `containerEdges` is here because it is the count that used to disappear:
 * B-run1's 16 container-addressed edges were 16 connections the canvas never
 * drew. They were always in these measurements — `measureRenderedReadability`
 * anchors an edge to whatever box it names, panel or leaf — which is exactly why
 * the geometry numbers do not move now that the canvas draws them too.
 */
const EXPECTED: Record<string, Expected> = {
  "A-run1 C4 insurer": {
    nodes: 33,
    edges: 33,
    containerEdges: 0,
    elkCrossings: 1,
    renderedCrossings: 10,
    elkEdgeNodeOverlaps: 0,
    renderedEdgeNodeOverlaps: 5,
    maxNestingDepth: 2,
  },
  "A-run2 C4 insurer": {
    nodes: 34,
    edges: 40,
    containerEdges: 0,
    elkCrossings: 0,
    renderedCrossings: 7,
    elkEdgeNodeOverlaps: 0,
    renderedEdgeNodeOverlaps: 5,
    maxNestingDepth: 2,
  },
  "A-run3 C4 insurer": {
    nodes: 34,
    edges: 40,
    containerEdges: 0,
    elkCrossings: 4,
    renderedCrossings: 51,
    elkEdgeNodeOverlaps: 0,
    renderedEdgeNodeOverlaps: 14,
    maxNestingDepth: 2,
  },
  "B-run1 AWS deployment": {
    nodes: 39,
    edges: 27,
    containerEdges: 16,
    elkCrossings: 7,
    renderedCrossings: 23,
    elkEdgeNodeOverlaps: 0,
    renderedEdgeNodeOverlaps: 23,
    maxNestingDepth: 4,
  },
  "B-run2 AWS deployment": {
    nodes: 42,
    edges: 33,
    containerEdges: 0,
    elkCrossings: 33,
    renderedCrossings: 99,
    elkEdgeNodeOverlaps: 0,
    renderedEdgeNodeOverlaps: 36,
    maxNestingDepth: 3,
  },
  "B-run3 AWS deployment": {
    nodes: 33,
    edges: 37,
    containerEdges: 0,
    elkCrossings: 52,
    renderedCrossings: 83,
    elkEdgeNodeOverlaps: 0,
    renderedEdgeNodeOverlaps: 7,
    maxNestingDepth: 4,
  },
};

interface Measured extends Expected {
  childrenOutsideParent: number;
  layoutWidth: number;
  layoutHeight: number;
}

async function measure(ir: DiagramIR): Promise<Measured> {
  const graph = await layoutElkGraph(irToLayoutGraph(ir));
  const labels = labelsOf(ir);
  const rendered = measureRenderedReadability(graph, ir.edges, {
    labels,
    handleOrder: readElkHandleOrder(graph),
  });
  const elk = measureReadability(graph, { labels });
  const { boxes, parentOf } = readLaidOutGraph(graph);

  const containers = new Set(
    ir.nodes.map((node) => node.parentId).filter((id): id is string => id !== null),
  );

  let childrenOutsideParent = 0;
  let maxNestingDepth = 0;
  for (const [id, parent] of parentOf.entries()) {
    if (!parent || parent === graph.id) continue;
    const child = boxes.get(id);
    const box = boxes.get(parent);
    if (child && box) {
      const escapes =
        child.x < box.x ||
        child.y < box.y ||
        child.x + child.width > box.x + box.width ||
        child.y + child.height > box.y + box.height;
      if (escapes) childrenOutsideParent += 1;
    }
    let depth = 0;
    let cursor: string | null | undefined = id;
    while (cursor && parentOf.get(cursor) && parentOf.get(cursor) !== graph.id) {
      depth += 1;
      cursor = parentOf.get(cursor);
    }
    maxNestingDepth = Math.max(maxNestingDepth, depth);
  }

  return {
    nodes: ir.nodes.length,
    edges: ir.edges.length,
    containerEdges: ir.edges.filter(
      (edge) => containers.has(edge.sourceId) || containers.has(edge.targetId),
    ).length,
    elkCrossings: elk.edgeCrossings,
    renderedCrossings: rendered.edgeCrossings,
    elkEdgeNodeOverlaps: elk.edgeNodeOverlaps,
    renderedEdgeNodeOverlaps: rendered.edgeNodeOverlaps,
    maxNestingDepth,
    childrenOutsideParent,
    layoutWidth: rendered.width,
    layoutHeight: rendered.height,
  };
}

describe("frozen generated diagrams", () => {
  it("are all schema-valid IR", () => {
    for (const { name, ir } of GENERATED_DIAGRAMS) {
      const result = validateIR(ir);
      const issues = result.ok ? [] : result.issues;
      expect(issues, `${name}: ${JSON.stringify(issues)}`).toHaveLength(0);
    }
  });

  it("carry a container-addressed edge somewhere in the set", () => {
    // The whole reason B-run1 is kept. If a future edit tidies it away, the
    // fixtures stop covering the case the slice was about.
    const total = Object.values(EXPECTED).reduce((sum, e) => sum + e.containerEdges, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe("frozen generated diagram measurements", () => {
  it.each(GENERATED_DIAGRAMS.map((d) => [d.name, d.ir] as const))(
    "%s measures exactly what it measured when frozen",
    async (name, ir) => {
      const measured = await measure(ir);
      const {
        childrenOutsideParent: _c,
        layoutWidth: _w,
        layoutHeight: _h,
        ...comparable
      } = measured;

      expect(comparable).toEqual(EXPECTED[name]);
    },
  );

  it("keeps every child inside its parent, four levels deep included", async () => {
    const rows: string[] = [];
    for (const { name, ir } of GENERATED_DIAGRAMS) {
      const measured = await measure(ir);
      rows.push(
        `${name.padEnd(24)} depth ${measured.maxNestingDepth}  outside ${measured.childrenOutsideParent}`,
      );
      expect(measured.childrenOutsideParent, name).toBe(0);
    }
    // Two of the six nest four deep — VPC > AZ > Subnet > service. Nothing else
    // in the repo's fixtures reaches that depth.
    console.info(`\nContainment\n${rows.join("\n")}\n`);
  });

  /**
   * The number Fatia 3 exists to attack: how far the drawn path is from the one
   * ELK routed. Printed rather than asserted per diagram — the per-diagram
   * numbers are already pinned above — but the total is pinned, because a change
   * that shifts the gap is the change that matters.
   */
  it("records the distance between ELK's routing and the drawn path", async () => {
    const rows: string[] = [];
    let elkTotal = 0;
    let renderedTotal = 0;

    for (const { name, ir } of GENERATED_DIAGRAMS) {
      const measured = await measure(ir);
      elkTotal += measured.elkCrossings;
      renderedTotal += measured.renderedCrossings;
      rows.push(
        `${name.padEnd(24)} elk ${String(measured.elkCrossings).padStart(3)} -> rendered ${String(
          measured.renderedCrossings,
        ).padStart(
          3,
        )}   gap ${String(measured.renderedCrossings - measured.elkCrossings).padStart(3)}`,
      );
    }

    console.info(
      `\nELK routing vs drawn path\n${rows.join("\n")}\n` +
        `TOTAL elk ${elkTotal} -> rendered ${renderedTotal}   gap ${renderedTotal - elkTotal}\n`,
    );

    expect(elkTotal).toBe(97);
    expect(renderedTotal).toBe(273);
  });
});
