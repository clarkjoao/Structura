import { useSyncExternalStore } from "react";
import type { NodeTypes } from "@xyflow/react";
import { getNodeTypesSnapshot, subscribeNodeTypes } from "./registry";

/** Reactive React Flow nodeTypes map — re-renders when plugins (un)register node types. */
export function useNodeTypes(): NodeTypes {
  return useSyncExternalStore(subscribeNodeTypes, getNodeTypesSnapshot);
}
