import { createContext, useContext } from "react";
import { useIdSetMember, type IdSetStore } from "./idSetStore";

/** The revealed connections, provided by `EdgeLabelRevealProvider`. */
export const EdgeLabelRevealContext = createContext<IdSetStore | null>(null);

/** Whether this edge's label shows at a zoom that hides edge labels (an end of it is selected). */
export function useIsEdgeLabelRevealed(connectionId: string): boolean {
  return useIdSetMember(useContext(EdgeLabelRevealContext), connectionId);
}
