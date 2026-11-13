import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useIdSetStore } from "./idSetStore";
import { HighlightMembershipContext } from "./highlightMembership";

interface HandleHighlightState {
  highlightedConnectionIds: Set<string>;
  highlightedNodeIds: Set<string>;
  setHighlight: (connectionIds: string | readonly string[], nodeIds: readonly string[]) => void;
  clearHighlight: () => void;
}

const EMPTY_IDS: Set<string> = new Set();

const HandleHighlightContext = createContext<HandleHighlightState>({
  highlightedConnectionIds: EMPTY_IDS,
  highlightedNodeIds: EMPTY_IDS,
  setHighlight: () => {},
  clearHighlight: () => {},
});

export function HandleHighlightProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: HandleHighlightState;
}) {
  const { highlightedConnectionIds, highlightedNodeIds, setHighlight, clearHighlight } = value;
  /**
   * Keyed on the four values it carries, not on `value`: the canvas hands a
   * fresh object each render — and `useLocalNodes` ticks one per drag frame —
   * so the context identity moves only when a highlight does.
   */
  const stableValue = useMemo(
    () => ({ highlightedConnectionIds, highlightedNodeIds, setHighlight, clearHighlight }),
    [highlightedConnectionIds, highlightedNodeIds, setHighlight, clearHighlight],
  );
  const nodes = useIdSetStore(highlightedNodeIds);
  const connections = useIdSetStore(highlightedConnectionIds);
  const membership = useMemo(() => ({ nodes, connections }), [nodes, connections]);
  return (
    <HandleHighlightContext.Provider value={stableValue}>
      <HighlightMembershipContext.Provider value={membership}>
        {children}
      </HighlightMembershipContext.Provider>
    </HandleHighlightContext.Provider>
  );
}

/** The whole highlight and its setters, for panels outside the canvas. Nodes and edges ask for their own membership (`highlightMembership.ts`). */
export function useHandleHighlight(): HandleHighlightState {
  return useContext(HandleHighlightContext);
}
