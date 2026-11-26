import { createContext } from "react";
import type { ShareContextValue } from "../types";

export const ShareContext = createContext<ShareContextValue>({
  sharedDiagram: null,
  clearShared: () => {},
});
