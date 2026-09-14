import type { EdgeTypes } from "@xyflow/react";
import EditableEdge from "../edges/EditableEdge";
import { DIAGRAM_EDGE_RF_TYPE } from "./reactFlowBaseConfig";

/** Shared edge-type map — one key for editor and viewer. */
export const diagramEdgeTypes: EdgeTypes = {
  [DIAGRAM_EDGE_RF_TYPE]: EditableEdge,
};
