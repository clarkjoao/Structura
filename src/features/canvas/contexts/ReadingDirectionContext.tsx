import { createContext, useContext } from "react";
import {
  DEFAULT_READING_DIRECTION,
  handleSides,
  type HandleSides,
  type ReadingDirection,
} from "../nodes/node-types/handle-sides";

/**
 * The reading direction of the diagram on this canvas (ADR-0013), for the node
 * renderers' handle sides.
 *
 * Without a provider every node reads left-to-right, which is every diagram
 * today. A provider, when one is added, has to wrap `<ReactFlow>` (nodes are
 * rendered by React Flow, not as children of the canvas component), and its
 * value is one string, so it re-renders nothing while it holds still.
 */
export const ReadingDirectionContext = createContext<ReadingDirection>(DEFAULT_READING_DIRECTION);

/** The sides this node's edges enter and leave by. */
export function useHandleSides(): HandleSides {
  return handleSides(useContext(ReadingDirectionContext));
}
