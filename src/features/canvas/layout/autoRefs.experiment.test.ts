import { describe, expect, it } from "vitest";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { layout } from "./layoutEngine";
import { chooseAutoRefs, planAutoRefs, type AutoRefPlanOptions } from "./autoRefs";
import { GENERATED_DIAGRAMS } from "./generated-diagrams";
import { REFERENCE_DIAGRAMS } from "./reference-diagrams";
import type { LayoutGraph } from "./contract";

/**
 * Does referencing hubs make the auto-layout read better, on the diagrams the
 * layout is tuned against? Each diagram is laid out as it is, then with the
 * references `chooseAutoRefs` keeps, both measured on the drawn path.
 *
 *   npx vitest run autoRefs.experiment --silent=false
 */

function optionsFor(graph: LayoutGraph): AutoRefPlanOptions {
  const containers = new Set(
    graph.nodes.map((node) => node.parentId).filter((id): id is string => id !== null),
  );
  return {
    canReference: (id) => !containers.has(id),
    refParentFor: (parentId) => parentId,
    refIdFor: (originalId, parentId) => `ref:${originalId}:${parentId ?? "root"}`,
    refSize: { width: 200, height: 48 },
  };
}

describe("auto references, measured", () => {
  it("prints before/after for every fixture and never reads worse", async () => {
    const rows: string[] = [];
    for (const { name, ir } of [...REFERENCE_DIAGRAMS, ...GENERATED_DIAGRAMS]) {
      const graph = irToLayoutGraph(ir);
      const options = optionsFor(graph);
      const hubs = planAutoRefs(graph, options);
      const choice = await chooseAutoRefs(graph, options, layout);
      const { baseline, score } = choice;
      rows.push(
        [
          name.padEnd(26),
          `hubs ${String(hubs.length).padStart(2)}`,
          `refs ${String(choice.groups.length).padStart(2)}`,
          `crossings ${String(baseline.edgeCrossings).padStart(3)} -> ${String(score.edgeCrossings).padStart(3)}`,
          `over-node ${String(baseline.edgeNodeOverlaps).padStart(3)} -> ${String(score.edgeNodeOverlaps).padStart(3)}`,
          `length ${Math.round(baseline.length)} -> ${Math.round(score.length)}`,
        ].join("  "),
      );
      expect(score.edgeCrossings + 2 * score.edgeNodeOverlaps, name).toBeLessThanOrEqual(
        baseline.edgeCrossings + 2 * baseline.edgeNodeOverlaps,
      );
    }
    console.log(`\n${rows.join("\n")}\n`);
  }, 120_000);
});
