import { createContext, useContext } from "react";
import type { Diagram } from "@/features/diagram";

interface ShareContextValue {
  sharedDiagram: Diagram | null;
  clearShared: () => void;
}

export const ShareContext = createContext<ShareContextValue>({
  sharedDiagram: null,
  clearShared: () => {},
});

export const useShare = () => useContext(ShareContext);
