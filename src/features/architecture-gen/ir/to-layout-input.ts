/**
 * Adapts the IR to the layout engine's input.
 *
 * A thin, total mapping: snake_case to camelCase, and tier defaults resolved. No geometry is
 * invented here — that is the engine's job, and this file must never grow a coordinate.
 */

import type { ComponentType } from "@/features/diagram";
import type { LayoutInput } from "@/lib/layout-engine";
import type { StructuralInput } from "@/lib/validators";
import { tiersFor, type ArchitectureIr } from "./schema";

export function toLayoutInput(ir: ArchitectureIr): LayoutInput {
  return {
    nodes: ir.nodes.map((node) => ({
      id: node.id,
      // The IR carries Structura's own component vocabulary, so this passes straight through.
      type: node.type as ComponentType,
      name: node.name,
      technology: node.technology,
      description: node.description,
      tier: node.tier,
      awsService: node.aws_service,
      emphasis: node.emphasis,
    })),
    boundaries: ir.boundaries?.map((boundary) => ({
      id: boundary.id,
      name: boundary.name,
      kind: boundary.kind,
      contains: boundary.contains,
      parentBoundaryId: boundary.parent_boundary_id,
      orderIndex: boundary.order_index,
    })),
    connections: ir.connections?.map((connection) => ({
      id: connection.id,
      from: connection.from,
      to: connection.to,
      label: connection.label,
      technology: connection.technology,
      intent: connection.intent,
      isPrimaryPath: connection.is_primary_path,
    })),
    tiers: tiersFor(ir),
    density: ir.meta.density_hint,
    primaryPath: ir.meta.primary_path,
  };
}

/** Projects the IR onto what the structural validators need. */
export function toStructuralInput(ir: ArchitectureIr): StructuralInput {
  return {
    nodes: ir.nodes.map((node) => ({ id: node.id, name: node.name, tier: node.tier })),
    boundaries: ir.boundaries?.map((boundary) => ({
      id: boundary.id,
      name: boundary.name,
      contains: boundary.contains,
      parent_boundary_id: boundary.parent_boundary_id,
    })),
    connections: ir.connections?.map((connection) => ({
      id: connection.id,
      from: connection.from,
      to: connection.to,
      label: connection.label,
    })),
  };
}
