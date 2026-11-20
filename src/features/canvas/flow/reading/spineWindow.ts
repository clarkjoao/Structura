/**
 * How much of a long spine the rail shows around the step in hand.
 *
 * A reading of thirty steps listed every walked and every upcoming step, and the scene being
 * read ended up a small card somewhere in the middle of a long scroll. The rail keeps a few on
 * each side and says how many it is holding back; opening a side shows all of it.
 */
export const SPINE_PAST_WINDOW = 3;
export const SPINE_UPCOMING_WINDOW = 5;
/**
 * A reading with more steps than this starts with its variables folded. Lower than the window:
 * at a laptop's height a seven-step flow with the block open left the spine three rows.
 */
export const VARIABLES_OPEN_MAX_ROWS = 6;

export interface WindowedRows<T> {
  shown: readonly T[];
  /** How many rows are held back; 0 when the side fits or is opened. */
  hidden: number;
}

/**
 * The rows of one side of the spine, windowed.
 *
 * `side` says which end is next to the step in hand: walked steps keep their tail, upcoming ones
 * their head. A side only one row over its window is shown whole — hiding a single row behind a
 * control that says "1 earlier" costs a click and saves nothing.
 */
export function windowSpineRows<T>(
  rows: readonly T[],
  side: "past" | "upcoming",
  open: boolean,
): WindowedRows<T> {
  const keep = side === "past" ? SPINE_PAST_WINDOW : SPINE_UPCOMING_WINDOW;
  if (open || rows.length <= keep + 1) return { shown: rows, hidden: 0 };
  return side === "past"
    ? { shown: rows.slice(rows.length - keep), hidden: rows.length - keep }
    : { shown: rows.slice(0, keep), hidden: rows.length - keep };
}
