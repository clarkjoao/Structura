import { createContext, useContext } from "react";

const NONE: ReadonlySet<string> = new Set();

/**
 * Connections attached to the current selection. When the canvas is zoomed out
 * far enough to hide edge labels, these still show theirs: what you selected
 * explains how it is wired.
 */
const EdgeLabelRevealContext = createContext<ReadonlySet<string>>(NONE);

export const EdgeLabelRevealProvider = EdgeLabelRevealContext.Provider;

export function useEdgeLabelReveal(): ReadonlySet<string> {
  return useContext(EdgeLabelRevealContext);
}
