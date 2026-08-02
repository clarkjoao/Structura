/**
 * Adapts the IR to the layout engine's input.
 *
 * A thin, total mapping: snake_case to camelCase, and tier defaults resolved. No geometry is
 * invented here — that is the engine's job, and this file must never grow a coordinate.
 */

import type { ComponentType } from "@/features/diagram";
import type { LayoutInput } from "@/lib/layout-engine";
import type { StructuralInput } from "@/lib/validators";
import { TIER_ORDER, type Tier } from "@/lib/layout-engine";
import { tierSchema, type ArchitectureIr } from "./schema";

/**
 * Derives the effective tier list from the IR's nodes, ordered by TIER_ORDER.
 * Used when `meta.tiers` is not explicitly provided.
 */
function deriveTiersFromNodes(ir: ArchitectureIr): Tier[] {
  const used = new Set<Tier>(ir.nodes.map((n) => n.tier));
  return TIER_ORDER.filter((tier) => used.has(tier));
}

export function toLayoutInput(ir: ArchitectureIr): LayoutInput {
  return {
    nodes: ir.nodes.map((node) => ({
      id: node.id,
      // The IR carries Structura's own component vocabulary, so this passes straight through.
      type: node.type as ComponentType,
      name: node.name,
      technology: node.technology,
      description: node.description,
      tier: node.tier as Tier,
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
    // Tiers from meta.tiers if provided, otherwise derived from the nodes.
    tiers: ir.meta.tiers ?? deriveTiersFromNodes(ir),
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
