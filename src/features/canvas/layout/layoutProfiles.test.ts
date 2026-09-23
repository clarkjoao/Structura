import { describe, expect, it } from "vitest";
import { ELK_OPTIONS_INTERACTIVE } from "./layoutEngine";

/**
 * The one option set: what Cmd/Ctrl+Shift+L / the Auto-layout button runs.
 *
 * There used to be a second, `visualization`, for `/viewer` to re-arrange a
 * diagram on load. It went with that re-layout — every surface draws the
 * layout the author saved (see `layoutEngine.ts`).
 */

describe("layout options", () => {
  it("read left to right", () => {
    // ELK has no "LEFT_TO_RIGHT" token; "RIGHT" is the left-to-right flow, and
    // a wrong value is silently ignored rather than rejected. AGENTS.md makes
    // this the diagram's reading direction.
    expect(ELK_OPTIONS_INTERACTIVE["elk.direction"]).toBe("RIGHT");
  });

  it("spend space on L→R layers", () => {
    expect(ELK_OPTIONS_INTERACTIVE).toEqual({
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.spacing.nodeNodeBetweenLayers": "220",
      "elk.spacing.nodeNode": "110",
      "elk.spacing.edgeNode": "40",
      "elk.spacing.edgeEdge": "25",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    });
  });
});
