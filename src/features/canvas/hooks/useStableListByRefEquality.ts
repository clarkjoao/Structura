import { useRef } from "react";


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
