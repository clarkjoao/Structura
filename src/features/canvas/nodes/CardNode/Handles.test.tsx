import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import { buildHandles, buildPanelHandles, handleTopCss } from "./Handles";

type Rendered = {
  key: string;
  props: {
    id?: string;
    className?: string;
    "aria-hidden"?: boolean;
    style?: Record<string, unknown>;
  };
};

const render = (nodes: React.ReactNode[]) => nodes as unknown as Rendered[];
const dots = (nodes: Rendered[]) => nodes.filter((node) => node.props["aria-hidden"]);
const slots = (nodes: Rendered[]) => nodes.filter((node) => node.props.id);

describe("buildHandles", () => {
  it("draws a bundled side as one dot, its slots there to connect to but unseen", () => {
    const nodes = render(buildHandles(3, "source", Position.Right, { elementId: "n" }, undefined));
    expect(slots(nodes).map((node) => node.props.id)).toEqual(["source-0", "source-1", "source-2"]);
    for (const slot of slots(nodes)) expect(slot.props.className).toContain("!bg-transparent");
    expect(dots(nodes)).toHaveLength(1);
  });

  it("keeps drawing a lone handle itself", () => {
    const nodes = render(buildHandles(1, "target", Position.Left, { elementId: "n" }, undefined));
    expect(dots(nodes)).toHaveLength(0);
    expect(slots(nodes)[0]!.props.className).toContain("!bg-muted-foreground");
  });

  it("lights up the slot a flow is playing, over the dot", () => {
    const nodes = render(
      buildHandles(
        3,
        "source",
        Position.Right,
        { elementId: "n", activeHandleId: "source-1" },
        undefined,
      ),
    );
    const lit = slots(nodes).filter((node) => !node.props.className?.includes("!bg-transparent"));
    expect(lit.map((node) => node.props.id)).toEqual(["source-1"]);
    expect(dots(nodes)).toHaveLength(1);
  });

  it("shows every slot while recording, since the user picks one", () => {
    const nodes = render(
      buildHandles(3, "source", Position.Right, { elementId: "n", isRecording: true }, undefined),
    );
    expect(dots(nodes)).toHaveLength(0);
    for (const slot of slots(nodes)) {
      expect(slot.props.className).not.toContain("!bg-transparent");
      // Narrower than the pitch, so neighbouring slots do not overlap.
      expect(slot.props.className).toContain("!w-[7px]");
    }
  });

  it("spreads a left or right side along the height, as always", () => {
    const placed = slots(
      render(buildHandles(3, "target", Position.Left, { elementId: "n" }, undefined)),
    );
    expect(placed.map((slot) => slot.props.style?.top)).toEqual(
      [0, 1, 2].map((i) => handleTopCss(i, 3)),
    );
    expect(placed.every((slot) => slot.props.style?.left === undefined)).toBe(true);
  });

  it("spreads a top or bottom side along the width, with the same formula", () => {
    const placed = slots(
      render(buildHandles(3, "source", Position.Bottom, { elementId: "n" }, undefined)),
    );
    expect(placed.map((slot) => slot.props.style?.left)).toEqual(
      [0, 1, 2].map((i) => handleTopCss(i, 3)),
    );
    expect(placed.every((slot) => slot.props.style?.top === undefined)).toBe(true);
  });

  it("puts a bundle's dot on the side it bundles", () => {
    const [right] = dots(
      render(buildHandles(3, "source", Position.Right, { elementId: "n" }, undefined)),
    );
    expect(right!.props.style).toMatchObject({ right: 0, top: "50%" });
    const [bottom] = dots(
      render(buildHandles(3, "source", Position.Bottom, { elementId: "n" }, undefined)),
    );
    expect(bottom!.props.style).toMatchObject({ bottom: 0, left: "50%" });
  });

  it("adds no dot to a panel, whose handles are invisible", () => {
    expect(dots(render(buildPanelHandles(3, "target", Position.Left, "vpc")))).toHaveLength(0);
  });
});

describe("handleTopCss", () => {
  it("centres one slot and bundles several around the middle", () => {
    expect(handleTopCss(0, 1)).toBe("50%");
    expect(handleTopCss(0, 3)).toBe("calc(50% + -1 * min(8px, 25%))");
    expect(handleTopCss(2, 3)).toBe("calc(50% + 1 * min(8px, 25%))");
  });
});
