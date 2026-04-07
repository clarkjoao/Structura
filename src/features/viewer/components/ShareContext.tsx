import { createContext, useContext } from "react";
import type { ShareContextValue } from "../types";

export const ShareContext = createContext<ShareContextValue>({
  sharedDiagram: null,
  clearShared: () => {},
});

export const useShare = (): ShareContextValue => useContext(ShareContext);
