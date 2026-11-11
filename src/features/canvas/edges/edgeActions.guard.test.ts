import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Every edge on a moving node renders once per drag frame. An action-bag
 * subscription (`useDiagramActions()` and friends) in that render runs its
 * selector over ~90 store keys each time, for values that never change; with
 * one in the edge and one in each gesture hook it was ~10% of a 180-node drag
 * at 400 nodes. The edge reads actions with `useDiagramStore.getState()`.
 */

const EDGES = __dirname;
const PER_EDGE_RENDER = [
  "EditableEdge.tsx",
  "interaction/useControlPoints.ts",
  "interaction/useSegmentDrag.ts",
  "interaction/useEdgeLabelDrag.ts",
];
const ACTION_SUBSCRIPTION = /\buse(Diagram|Component|Connection|Layout)Actions\(\)/;

describe("edge renders", () => {
  it("do not subscribe to store action bags", () => {
    const offenders = PER_EDGE_RENDER.filter((file) =>
      ACTION_SUBSCRIPTION.test(fs.readFileSync(path.join(EDGES, file), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
