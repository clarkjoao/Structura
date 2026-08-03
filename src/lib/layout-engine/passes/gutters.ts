/**
 * P4 — sizes gutters between columns by channel demand.
 *
 * Stub: returns state unchanged. Full implementation counts how many edges need a
 * vertical channel through each gutter, computes the required gutter width, and
 * reflows column x positions accordingly.
 */
import { cloneState, type LayoutPass } from "../types";

export const sizeGutters: LayoutPass = (input) => cloneState(input);
