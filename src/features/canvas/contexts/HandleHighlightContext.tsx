import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface HandleHighlightState {
  highlightedConnectionId: string | null;
  setHighlight: (connectionId: string) => void;
  clearHighlight: () => void;
}

const HandleHighlightContext = createContext<HandleHighlightState>({
  highlightedConnectionId: null,
  setHighlight: () => {},
  clearHighlight: () => {},
});

export function HandleHighlightProvider({ children }: { children: ReactNode }) {
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<
    string | null
  >(
    null,
  );

  const setHighlight = useCallback((connectionId: string) => {
    setHighlightedConnectionId(connectionId);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedConnectionId(null);
  }, []);

  return (
    <HandleHighlightContext.Provider
      value={{ highlightedConnectionId, setHighlight, clearHighlight }}
    >
      {children}
    </HandleHighlightContext.Provider>
  );
}

export function useHandleHighlight(): HandleHighlightState {
  return useContext(HandleHighlightContext);
}
