import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import { NODE_TYPE_REGISTRY } from "@/features/canvas/nodes/node-types";
import { default as EditableEdge } from "@/features/canvas/edges/EditableEdge";

export const EMBED_NODE_TYPES: NodeTypes = Object.fromEntries(
  NODE_TYPE_REGISTRY.map((descriptor) => [descriptor.rfType, descriptor.component]),
) as NodeTypes;

export const EMBED_EDGE_TYPES: EdgeTypes = {
  custom: EditableEdge,
};
