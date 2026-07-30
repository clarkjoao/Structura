import { useRef } from "react";

/**
 * Returns a Set that only changes reference when its membership changes.
 * Analogous to `useStableListByRefEquality` but for Sets.
 */
export function useStableSetByContent<T>(next: Set<T>): Set<T> {
  const ref = useRef<Set<T> | null>(null);
  if (ref.current === null) {
    ref.current = next;
    return next;
  }
  const prev = ref.current;
  if (prev.size !== next.size) {
    ref.current = next;
    return next;
  }
  for (const item of next) {
    if (!prev.has(item)) {
      ref.current = next;
      return next;
    }
  }
  return prev;
}
