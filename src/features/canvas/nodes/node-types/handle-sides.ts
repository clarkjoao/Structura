import type { CSSProperties } from "react";
import { Position } from "@xyflow/react";
import type { DiagramDirection } from "@/features/diagram/model/diagram.types";

/**
 * Which side of a node an edge enters and leaves, by the diagram's reading
 * direction (ADR-0013).
 *
 * The rule is the one `edges/connectionDerivations.ts` states: sides are fixed
 * by a declaration, never derived from where the nodes sit. Left-to-right is the
 * only direction a diagram has today — input on the left, output on the right,
 * and the flowchart shapes' cross axis on the top (in) and bottom (out).
 * Top-to-bottom turns the axes: input on top, output at the bottom, cross axis
 * left (in) and right (out).
 *
 * The one place a node learns its sides; no renderer names a `Position` for
 * them itself (`nodes/handleSides.guard.test.ts`).
 */
export type ReadingDirection = DiagramDirection;

export const DEFAULT_READING_DIRECTION: ReadingDirection = "LR";

export interface HandleSides {
  /** Where every edge arrives. */
  input: Position;
  /** Where every edge leaves. */
  output: Position;
  /** The flowchart shapes' extra input (`verticalSides` today), stored on the edge. */
  crossInput: Position;
  /** The flowchart shapes' extra output, stored on the edge. */
  crossOutput: Position;
}

const LEFT_TO_RIGHT: HandleSides = {
  input: Position.Left,
  output: Position.Right,
  crossInput: Position.Top,
  crossOutput: Position.Bottom,
};

const TOP_TO_BOTTOM: HandleSides = {
  input: Position.Top,
  output: Position.Bottom,
  crossInput: Position.Left,
  crossOutput: Position.Right,
};

export function handleSides(direction: ReadingDirection): HandleSides {
  return direction === "TB" ? TOP_TO_BOTTOM : LEFT_TO_RIGHT;
}

/**
 * Whether a side runs up and down the node (left or right), so its slots are
 * spread along the height; a top or bottom side spreads them along the width.
 */
export function isSideAlongHeight(side: Position): boolean {
  return side === Position.Left || side === Position.Right;
}

/**
 * Pins an absolutely positioned marker to the middle of `side`, centred on the
 * border the way React Flow centres a handle (half outside the node).
 */
export function middleOfSideStyle(side: Position): CSSProperties {
  switch (side) {
    case Position.Left:
      return { top: "50%", left: 0, transform: "translate(-50%, -50%)" };
    case Position.Right:
      return { top: "50%", right: 0, transform: "translate(50%, -50%)" };
    case Position.Top:
      return { left: "50%", top: 0, transform: "translate(-50%, -50%)" };
    case Position.Bottom:
      return { left: "50%", bottom: 0, transform: "translate(-50%, 50%)" };
  }
}
