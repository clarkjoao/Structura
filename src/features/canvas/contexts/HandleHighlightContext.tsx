import { createContext, useContext, type ReactNode } from "react";

interface HandleHighlightState {
  highlightedConnectionId: string | null;
  highlightedNodeIds: Set<string>;
  setHighlight: (connectionId: string, nodeIds: string[]) => void;
  clearHighlight: () => void;
}

const HandleHighlightContext = createContext<HandleHighlightState>({
  highlightedConnectionId: null,
  highlightedNodeIds: new Set(),
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
