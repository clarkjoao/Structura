import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * A function whose identity never changes and that always calls the latest
 * `callback`.
 *
 * For handlers React Flow keeps in its store or passes to every node
 * (`canvas-hot-path.md` §3): React Flow's `NodeWrapper` is not memoised, so a
 * new `onNodeClick` identity re-renders every node on the canvas — on the
 * large-diagram fixture that was 657 node renders on every store write, the end
 * of every pan included. Only for event handlers: the callback must not be
 * called during render.
 */
export function useStableCallback<Args extends unknown[], R>(
  callback: (...args: Args) => R,
): (...args: Args) => R {
  const latest = useRef(callback);
  useLayoutEffect(() => {
    latest.current = callback;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
