import { describe, expect, it } from "vitest";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { transposeGraph } from "./axis";
import { layoutElkGraph } from "./layoutEngine";
import { measureReadability } from "./layoutReadability";
import { labelsOf, REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * Top-to-bottom readability, measured. Measurement only.
 *
 * A top-to-bottom layout is the left-to-right pipeline on the mirrored graph
 * (`axis.ts`), so its counters are read on that mirrored ELK output — crossings
 * and overlaps do not change under a reflection, only width and height swap.
 * The left-to-right spacing is reused as is; these numbers are what a
 * vertical-specific tuning would have to beat.
 *
 *   npx vitest run directionReadability.experiment --silent=false
 */
describe("reading direction readability", () => {
  it("measures left-to-right against top-to-bottom", async () => {
    const rows: string[] = [];
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = irToLayoutGraph(ir);
      const labels = labelsOf(ir);
      const lr = measureReadability(await layoutElkGraph(graph), { labels });
      const tb = measureReadability(await layoutElkGraph(transposeGraph(graph)), { labels });
      rows.push(
        `${name}\n  LR crossings ${lr.edgeCrossings} edge/node ${lr.edgeNodeOverlaps} labels ${lr.labelOverlaps} ${lr.width}x${lr.height}` +
          `\n  TB crossings ${tb.edgeCrossings} edge/node ${tb.edgeNodeOverlaps} labels ${tb.labelOverlaps} ${tb.height}x${tb.width}`,
      );
    }
    process.stdout.write(`${rows.join("\n")}\n`);
    expect(rows).toHaveLength(REFERENCE_DIAGRAMS.length);
  }, 120_000);
});
