import { createContext, useContext } from "react";
import { useIdSetMember, type IdSetStore } from "./idSetStore";

/**
 * What nodes and edges read of the handle highlight: their own membership.
 * The highlight's context value changes with every highlight, and every
 * consumer of it re-rendered — clicking one edge re-ran every node renderer on
 * the canvas. Provided by `HandleHighlightProvider`.
 */
export interface HighlightMembership {
  nodes: IdSetStore;
  connections: IdSetStore;
}

export const HighlightMembershipContext = createContext<HighlightMembership | null>(null);

export function useIsNodeHandleHighlighted(nodeId: string): boolean {
  return useIdSetMember(useContext(HighlightMembershipContext)?.nodes ?? null, nodeId);
}

export function useIsConnectionHandleHighlighted(connectionId: string): boolean {
  return useIdSetMember(useContext(HighlightMembershipContext)?.connections ?? null, connectionId);
}
