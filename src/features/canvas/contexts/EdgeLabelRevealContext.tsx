import type { ReactNode } from "react";
import { EdgeLabelRevealContext } from "./edgeLabelReveal";
import { useIdSetStore } from "./idSetStore";

/**
 * Connections attached to the current selection. When the canvas is zoomed out
 * far enough to hide edge labels, these still show theirs: what you selected
 * explains how it is wired.
 *
 * Every edge asks for itself (`useIsEdgeLabelRevealed`): a selection change
 * re-renders the edges whose answer changed, not every edge on the canvas.
 */
export function EdgeLabelRevealProvider({
  value,
  children,
}: {
  value: ReadonlySet<string>;
  children: ReactNode;
}) {
  const store = useIdSetStore(value);
  return (
    <EdgeLabelRevealContext.Provider value={store}>{children}</EdgeLabelRevealContext.Provider>
  );
}
