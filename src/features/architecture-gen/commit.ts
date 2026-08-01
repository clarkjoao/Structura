/**
 * Turns a committed layout into the store payload.
 *
 * The engine works in absolute coordinates; the store keeps node layouts in absolute
 * coordinates too, with parenting expressed by `parentId`. So this is a projection, not a
 * transform — no position is recomputed here.
 */

import type { ComponentType } from "@/features/diagram";
import type { ArchitecturePayload } from "@/features/diagram/store/slices/architecture.slice";
import type { LayoutState } from "@/lib/layout-engine/types";

/**
 * Projects final layout state onto the store payload.
 *
 * Boundaries are emitted first so a parent always precedes the children that name it — the
 * store resolves `parentIrId` through an id map built in declaration order.
 */
export function toStorePayload(state: LayoutState): ArchitecturePayload {
  const nodes: ArchitecturePayload["nodes"] = [];

  const boundaries = [...state.boundaries.values()].sort((a, b) => a.depth - b.depth);
  for (const boundary of boundaries) {
    nodes.push({
      irId: boundary.id,
      type: "panel" as ComponentType,
      name: boundary.name,
      parentIrId: boundary.parentBoundaryId,
      x: boundary.x,
      y: boundary.y,
      width: boundary.width,
      height: boundary.height,
    });
  }

  for (const node of state.nodes.values()) {
    nodes.push({
      irId: node.id,
      type: node.type,
      name: node.name,
      description: node.description,
      technology: node.technology,
      awsService: node.awsService,
      parentIrId: node.boundaryId,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    });
  }

  return {
    nodes,
    connections: state.connections.map((connection) => ({
      fromIrId: connection.from,
      toIrId: connection.to,
      label: connection.label,
    })),
  };
}
