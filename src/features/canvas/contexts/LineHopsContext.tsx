import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Point } from "@/features/diagram";
import type { LineHop } from "../edges/geometry/lineHops";
import {
  createLineHopsRegistry,
  NO_LINE_HOPS,
  type LineHopsRegistry,
} from "../edges/lineHopsRegistry";

/**
 * One line-hops registry per canvas surface.
 *
 * Like `ElementsSelectableContext`, the provider has to wrap `<ReactFlow>`:
 * edges are rendered by React Flow's own renderer, so a child of `<ReactFlow>`
 * is their sibling, not their ancestor. The value is created once and never
 * changes, so the context itself re-renders nothing; edges hear about hops
 * through their own subscription. With no provider, edges draw no hops.
 */
const LineHopsContext = createContext<LineHopsRegistry | null>(null);

export function LineHopsProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createLineHopsRegistry);
  return <LineHopsContext.Provider value={registry}>{children}</LineHopsContext.Provider>;
}

const noopUnsubscribe = () => {};

/**
 * Publishes this edge's drawn path and returns where it hops. `points` is
 * `null` for an edge that takes no part (not orthogonal); it is then neither an
 * obstacle nor a hopper.
 */
export function useLineHops(id: string, points: readonly Point[] | null): readonly LineHop[] {
  const registry = useContext(LineHopsContext);

  useLayoutEffect(() => {
    if (!registry) return;
    if (points) registry.publish(id, points);
    else registry.remove(id);
  }, [registry, id, points]);

  useEffect(() => {
    if (!registry) return;
    return () => registry.remove(id);
  }, [registry, id]);

  const subscribe = useCallback(
    (listener: () => void) => (registry ? registry.subscribe(id, listener) : noopUnsubscribe),
    [registry, id],
  );
  const getSnapshot = useCallback(
    () => (registry ? registry.getHops(id) : NO_LINE_HOPS),
    [registry, id],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
