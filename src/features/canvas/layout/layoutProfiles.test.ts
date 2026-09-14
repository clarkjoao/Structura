import { describe, expect, it } from "vitest";
import { ELK_OPTIONS_INTERACTIVE, ELK_OPTIONS_VISUALIZATION } from "./layoutEngine";

/**
 * Two contexts, two option sets.
 *
 * `interactive` is what the auto-layout button has always run and is not
 * allowed to drift here: the user pressed a button on a diagram they had
 * already arranged, and the job is to not make it worse. `visualization` is
 * the reading view — nobody arranged anything, so it can spend space on
 * clarity.
 */

describe("layout profiles", () => {
  it("both read left to right", () => {
    // ELK has no "LEFT_TO_RIGHT" token; "RIGHT" is the left-to-right flow, and
    // a wrong value is silently ignored rather than rejected. AGENTS.md makes
    // this the diagram's reading direction, so neither profile may leave it.
    expect(ELK_OPTIONS_INTERACTIVE["elk.direction"]).toBe("RIGHT");
    expect(ELK_OPTIONS_VISUALIZATION["elk.direction"]).toBe("RIGHT");
  });

  it("the interactive profile is unchanged by the split", () => {
    expect(ELK_OPTIONS_INTERACTIVE).toEqual({
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.spacing.nodeNodeBetweenLayers": "150",
      "elk.spacing.nodeNode": "80",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    });
  });

  it("the visualization profile keeps the hierarchy and spends more space", () => {
    expect(ELK_OPTIONS_VISUALIZATION["elk.hierarchyHandling"]).toBe("INCLUDE_CHILDREN");

    const nodeNode = Number(ELK_OPTIONS_VISUALIZATION["elk.spacing.nodeNode"]);
    const betweenLayers = Number(
      ELK_OPTIONS_VISUALIZATION["elk.layered.spacing.nodeNodeBetweenLayers"],
    );
    expect(nodeNode).toBeGreaterThan(Number(ELK_OPTIONS_INTERACTIVE["elk.spacing.nodeNode"]));
    expect(betweenLayers).toBeGreaterThan(
      Number(ELK_OPTIONS_INTERACTIVE["elk.layered.spacing.nodeNodeBetweenLayers"]),
    );
  });

  /**
   * The one option that moved the crossing count rather than the canvas size,
   * measured the way `/viewer` actually draws — orthogonal steps between handles,
   * with ELK's routed path discarded. Over the four reference diagrams: 15
   * crossings with the interactive profile's BRANDES_KOEPF, 13 with this.
   *
   * The profiles differ here on purpose. The interactive profile keeps
   * BRANDES_KOEPF, whose straight long edges are what the editor renders from
   * ELK's waypoints; with those thrown away, straightness is not what reaches
   * the reader.
   */
  it("the two profiles place nodes differently, on purpose", () => {
    expect(ELK_OPTIONS_INTERACTIVE["elk.layered.nodePlacement.strategy"]).toBe("BRANDES_KOEPF");
    expect(ELK_OPTIONS_VISUALIZATION["elk.layered.nodePlacement.strategy"]).toBe("NETWORK_SIMPLEX");
  });
});
