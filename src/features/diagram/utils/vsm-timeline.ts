import type { VsmTimelineSegment, VsmTimeUnit } from "../model/component.types";

/** The unit a timeline without one is in. */
export const DEFAULT_VSM_TIME_UNIT: VsmTimeUnit = "min";

export interface VsmTimelineTotals {
  /** Everything the work spends in the stream: every wait plus every process time. */
  leadTime: number;
  /** Only the time spent being worked on. */
  valueAdded: number;
}

/**
 * A timeline's totals, computed — never typed in, never stored. A value that
 * is not a finite, non-negative number counts as zero rather than poisoning
 * the sum.
 */
export function vsmTimelineTotals(segments: readonly VsmTimelineSegment[]): VsmTimelineTotals {
  const valid = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  let wait = 0;
  let valueAdded = 0;
  for (const segment of segments) {
    wait += valid(segment.wait);
    valueAdded += valid(segment.process);
  }
  return { leadTime: round(wait + valueAdded), valueAdded: round(valueAdded) };
}

/** Sums of decimals without the float noise (0.1 + 0.2). */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
