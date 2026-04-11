import { useRef } from "react";

/**
 * Returns the previous array reference when `next` has the same length and
 * each element is `===` to the previous render — avoids downstream memos/hooks
 * invalidating when the upstream selector produced a fresh `[]` with identical
 * contents (common with `filter` / `Object.values`).
 */
export function useStableListByRefEquality<T>(next: T[]): T[] {
  const ref = useRef<T[] | null>(null);
  if (ref.current === null) {
    ref.current = next;
    return next;
  }
  const prev = ref.current;
  if (prev.length !== next.length) {
    ref.current = next;
    return next;
  }
  for (let index = 0; index < prev.length; index++) {
    if (prev[index] !== next[index]) {
      ref.current = next;
      return next;
    }
  }
  return prev;
}
