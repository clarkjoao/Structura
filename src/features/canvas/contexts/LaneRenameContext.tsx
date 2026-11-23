import { createContext, useContext } from "react";

/**
 * Renaming a lane in place from its header (spec guided-direct-editing): provided by
 * the editor canvas while a kind arranges the diagram and structure may be edited;
 * absent (null) on read-only surfaces and freehand diagrams.
 */
export const LaneRenameContext = createContext<((laneId: string, name: string) => void) | null>(
  null,
);

export const useLaneRename = () => useContext(LaneRenameContext);
