/**
 * Which cards are drawn expanded right now (selected, highlighted, the active
 * step): a long name wraps and the description scrolls in up to twice the
 * resting height.
 *
 * The expansion is a passing state of the card, not its size. The editor
 * writes what React Flow measures back to `nodeLayouts`, and a card declares
 * that stored height as a floor (`laidOutMinHeight`) — so an expanded
 * measurement written back would become the card's height for good, on the
 * editor and on every reader. `useNodeDragParenting` asks this before writing
 * a measurement, and skips the card while it is expanded.
 *
 * Counted, not a set: the same id can be on two surfaces at once.
 */
const expandedCount = new Map<string, number>();

/** Marks `elementId` expanded until the returned release is called. */
export function holdCardExpanded(elementId: string): () => void {
  expandedCount.set(elementId, (expandedCount.get(elementId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (expandedCount.get(elementId) ?? 1) - 1;
    if (left > 0) expandedCount.set(elementId, left);
    else expandedCount.delete(elementId);
  };
}

/** Whether a card with this id is drawn expanded on some surface. */
export function isCardExpanded(elementId: string): boolean {
  return expandedCount.has(elementId);
}
