import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";

/**
 * A set of ids that components ask one member of.
 *
 * Canvas-wide sets (what is highlighted, which labels are revealed) used to
 * reach nodes and edges as a context value. Every consumer of a context
 * re-renders when its value changes, `memo` or not, so one highlighted edge
 * re-rendered every node on the canvas, and every selection every edge. Here a
 * component subscribes to its own membership: it re-renders only when it
 * joins or leaves the set.
 */
export interface IdSetStore {
  has(id: string): boolean;
  subscribe(listener: () => void): () => void;
  set(ids: ReadonlySet<string>): void;
}

export function createIdSetStore(initial: ReadonlySet<string>): IdSetStore {
  let ids = initial;
  const listeners = new Set<() => void>();
  return {
    has: (id) => ids.has(id),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      if (next === ids) return;
      ids = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * A store that follows `ids`. It starts with them, so the first render reads
 * the right answer, and takes each new set in a layout effect: members re-render
 * in the same frame.
 */
export function useIdSetStore(ids: ReadonlySet<string>): IdSetStore {
  const [store] = useState(() => createIdSetStore(ids));
  useLayoutEffect(() => {
    store.set(ids);
  }, [store, ids]);
  return store;
}

const neverSubscribed = () => () => {};
const notAMember = () => false;

/** Whether `id` is in the set; false without a store (a surface that provides none). */
export function useIdSetMember(store: IdSetStore | null, id: string): boolean {
  const getSnapshot = useCallback(() => (store ? store.has(id) : false), [store, id]);
  return useSyncExternalStore(
    store ? store.subscribe : neverSubscribed,
    store ? getSnapshot : notAMember,
    store ? getSnapshot : notAMember,
  );
}
