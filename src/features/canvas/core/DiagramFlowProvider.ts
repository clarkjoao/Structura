/**
 * React Flow provider / instance / type accessors — the only seam that
 * hosts and sibling features should use. Keeps `@xyflow/react` imports
 * inside `features/canvas` (ADR-0001).
 */
import type { NodeTypes } from "@xyflow/react";

export {
  Controls as DiagramControls,
  MiniMap as DiagramMiniMap,
  NodeToolbar as DiagramNodeToolbar,
  Panel as DiagramPanel,
  Position as DiagramPosition,
  ReactFlowProvider as DiagramFlowProvider,
  useReactFlow as useDiagramFlow,
} from "@xyflow/react";
export type {
  Node as DiagramNode,
  NodeTypes as DiagramNodeTypes,
  ReactFlowInstance as DiagramFlowInstance,
} from "@xyflow/react";

/** React component contract for a registered diagram node type. */
export type DiagramNodeComponent = NodeTypes[string];
