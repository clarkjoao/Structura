import type { Node } from "@xyflow/react";

export function getNodeType(node: Node): string {
  return node.type ?? "";
}
