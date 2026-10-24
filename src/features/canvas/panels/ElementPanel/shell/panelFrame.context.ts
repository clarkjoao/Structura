import { createContext, useContext } from "react";

export const PanelFrameContext = createContext<{ collapse: () => void } | null>(null);

/** The frame's controls for a header that wants a "fold" button; null outside a frame. */
export function usePanelFrame() {
  return useContext(PanelFrameContext);
}
