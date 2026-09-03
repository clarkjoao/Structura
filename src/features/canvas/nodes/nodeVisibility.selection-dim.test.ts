import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { computeNodeVisibility, selectionDimOpacity } from "./nodeVisibility";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM } from "../canvas.constants";
import type { NodeTypeDescriptor } from "./node-types/types";

/**
 * Which of the two dimming systems decides.
 *
 * The flow's own dimming lives in each descriptor's `buildStyle`; the
 * selection's lives here. They share one `opacity`, and the selection used to
 * be applied last and win — so a node that was step 1 of the script was drawn
 * exactly as dim as a node the script never mentions.
 */

const component = (id: string) =>
  ({ id, name: id, type: "system", parentId: null }) as unknown as Component;

const descriptor = {
  rfType: "c4",
  canHaveParent: true,
  zIndex: 1,
} as unknown as NodeTypeDescriptor;

/** `computeNodeVisibility` for one node, with `selected` holding the selection. */
function visibilityOf(id: string, selected: string[]) {
  return computeNodeVisibility(
    component(id),
    descriptor,
    undefined,
    new Set<string>(),
    new Set(selected),
    new Set<string>(),
    new Set<string>(),
    false,
    null,
    { [id]: component(id) },
  );
}

describe("outside a flow the selection dims, exactly as it always did", () => {
  it("dims a node that is not the selected one", () => {
    const vis = visibilityOf("b", ["a"]);

    expect(vis.dimmed).toBe(true);
    expect(selectionDimOpacity(vis, false)).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM);
  });

  it("leaves the selected node alone", () => {
    const vis = visibilityOf("a", ["a"]);

    expect(vis.dimmed).toBe(false);
    expect(selectionDimOpacity(vis, false)).toBeUndefined();
  });

  it("dims nothing when nothing is selected", () => {
    const vis = visibilityOf("a", []);

    expect(vis.dimmed).toBe(false);
    expect(selectionDimOpacity(vis, false)).toBeUndefined();
  });

  it("leaves every member of a multiple selection alone", () => {
    expect(selectionDimOpacity(visibilityOf("a", ["a", "c"]), false)).toBeUndefined();
    expect(selectionDimOpacity(visibilityOf("c", ["a", "c"]), false)).toBeUndefined();
    expect(selectionDimOpacity(visibilityOf("b", ["a", "c"]), false)).toBe(
      OPACITY_FLOW_PLAYBACK_NODE_DIM,
    );
  });
});

describe("while a flow is open the flow decides and the selection stands down", () => {
  it("does not dim an unselected node while recording or reading", () => {
    const vis = visibilityOf("b", ["a"]);

    // Still dimmed as far as the selection is concerned — it just does not apply.
    expect(vis.dimmed).toBe(true);
    expect(selectionDimOpacity(vis, true)).toBeUndefined();
  });

  it("is the node in the script that this protects", () => {
    // "b" is step 1 of the open script and "a" is merely selected. Before, the
    // selection dimmed "b" to the same value as a node the script never names.
    const stepOne = visibilityOf("b", ["a"]);

    expect(selectionDimOpacity(stepOne, true)).toBeUndefined();
    expect(selectionDimOpacity(stepOne, false)).toBe(OPACITY_FLOW_PLAYBACK_NODE_DIM);
  });

  it("still contributes nothing for a node the selection was not dimming", () => {
    const vis = visibilityOf("a", ["a"]);

    expect(selectionDimOpacity(vis, true)).toBeUndefined();
  });

  it("returns a real number outside the flow and nothing inside it, for the same node", () => {
    const vis = visibilityOf("b", ["a"]);

    expect(typeof selectionDimOpacity(vis, false)).toBe("number");
    expect(typeof selectionDimOpacity(vis, true)).toBe("undefined");
  });
});
