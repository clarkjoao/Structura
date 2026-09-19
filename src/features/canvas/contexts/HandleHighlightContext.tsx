import { createContext, useContext, type ReactNode } from "react";

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
  return (
    <HandleHighlightContext.Provider value={value}>{children}</HandleHighlightContext.Provider>
  );
}

export function useHandleHighlight(): HandleHighlightState {
  return useContext(HandleHighlightContext);
}
