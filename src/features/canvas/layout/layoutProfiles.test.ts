import { describe, expect, it } from "vitest";
import { ELK_OPTIONS_INTERACTIVE, ELK_OPTIONS_VISUALIZATION } from "./layoutEngine";

/**
 * Two contexts, two option sets.
 *
 * `interactive` is what Cmd/Ctrl+Shift+L / the Auto-layout button runs.
 * Spacing is shared with the reading view (wide L→R layers); placement is
 * BRANDES_KOEPF so editor waypoints stay straight. `visualization` only swaps
 * placement to NETWORK_SIMPLEX for `/viewer`.
 */

describe("layout profiles", () => {
  it("both read left to right", () => {
    // ELK has no "LEFT_TO_RIGHT" token; "RIGHT" is the left-to-right flow, and
    // a wrong value is silently ignored rather than rejected. AGENTS.md makes
    // this the diagram's reading direction, so neither profile may leave it.
    expect(ELK_OPTIONS_INTERACTIVE["elk.direction"]).toBe("RIGHT");
    expect(ELK_OPTIONS_VISUALIZATION["elk.direction"]).toBe("RIGHT");
  });

  it("the interactive profile spends space on L→R layers", () => {
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

  it("the visualization profile keeps the hierarchy and at least the interactive spacing", () => {
    expect(ELK_OPTIONS_VISUALIZATION["elk.hierarchyHandling"]).toBe("INCLUDE_CHILDREN");

    const nodeNode = Number(ELK_OPTIONS_VISUALIZATION["elk.spacing.nodeNode"]);
    const betweenLayers = Number(
      ELK_OPTIONS_VISUALIZATION["elk.layered.spacing.nodeNodeBetweenLayers"],
    );
    expect(nodeNode).toBeGreaterThanOrEqual(
      Number(ELK_OPTIONS_INTERACTIVE["elk.spacing.nodeNode"]),
    );
    expect(betweenLayers).toBeGreaterThanOrEqual(
      Number(ELK_OPTIONS_INTERACTIVE["elk.layered.spacing.nodeNodeBetweenLayers"]),
    );
  });

  /**
   * The one option that moved the crossing count rather than the canvas size,
   * measured the way `/viewer` actually draws — orthogonal steps between handles,
   * with ELK's routed path discarded. Over the four reference diagrams: 15
   * crossings with the interactive profile's BRANDES_KOEPF, 13 with this.
   *
   * The profiles still differ on purpose. Interactive keeps BRANDES_KOEPF so
   * long edges stay straight for the editor's stored ELK waypoints
   * (Cmd/Ctrl+Shift+L now writes those CPs). Visualization uses NETWORK_SIMPLEX
   * because `/viewer` still discards routed paths.
   */
  it("the two profiles place nodes differently, on purpose", () => {
    expect(ELK_OPTIONS_INTERACTIVE["elk.layered.nodePlacement.strategy"]).toBe("BRANDES_KOEPF");
    expect(ELK_OPTIONS_VISUALIZATION["elk.layered.nodePlacement.strategy"]).toBe("NETWORK_SIMPLEX");
  });
});
