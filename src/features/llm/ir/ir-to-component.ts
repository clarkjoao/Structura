// Leaf imports rather than the `@/features/diagram` barrel: this module is pure
// mapping, and going through the barrel would drag the whole store in with it.
import { PanelKind } from "@/features/diagram/enums";
import type { ComponentType } from "@/features/diagram/model/component.types";
import type { SemanticType } from "./ir.types";

/**
 * Semantic types that always render as a boundary box, whether or not the model
 * put anything inside them.
 */
export const IR_BOUNDARY_SEMANTIC_TYPES = [
  "aws-vpc",
  "aws-az",
  "aws-subnet",
  "aws-public-subnet",
  "aws-private-subnet",
] as const;

type BoundarySemanticType = (typeof IR_BOUNDARY_SEMANTIC_TYPES)[number];

const BOUNDARY_PANEL_KIND: Record<BoundarySemanticType, PanelKind> = {
  "aws-vpc": PanelKind.Vpc,
  "aws-az": PanelKind.AvailabilityZone,
  // The IR can say "subnet" without committing to public/private; a neutral
  // panel is more honest than guessing one of the two.
  "aws-subnet": PanelKind.Default,
  "aws-public-subnet": PanelKind.PublicSubnet,
  "aws-private-subnet": PanelKind.PrivateSubnet,
};

/**
 * Leaf mapping. Note "database": Structura's C4 model has no database type, so
 * it degrades to a container — the technology field carries the engine name.
 */
const LEAF_COMPONENT_TYPE: Record<Exclude<SemanticType, BoundarySemanticType>, ComponentType> = {
  person: "person",
  "external-system": "system",
  container: "container",
  database: "container",
  component: "component",
  "aws-compute": "aws-compute",
  "aws-database": "aws-database",
  "aws-storage": "aws-storage",
  "aws-networking": "aws-networking",
  "aws-security": "aws-security",
  "aws-integration": "aws-integration",
  "aws-management": "aws-management",
};

export interface MappedComponentType {
  type: ComponentType;
  panelKind?: PanelKind;
}

export function isBoundarySemanticType(
  semanticType: SemanticType,
): semanticType is BoundarySemanticType {
  return (IR_BOUNDARY_SEMANTIC_TYPES as readonly string[]).includes(semanticType);
}

/**
 * Translates an IR node into a Structura component type.
 *
 * `hasChildren` is part of the input because React Flow only nests a node
 * visually when its parent is a panel (see `computeNodeVisibility`). Any IR node
 * with children therefore has to become a panel, whatever its semanticType —
 * that is how a C4 system or container boundary is drawn here.
 */
export function mapSemanticTypeToComponent(
  semanticType: SemanticType,
  hasChildren: boolean,
): MappedComponentType {
  if (isBoundarySemanticType(semanticType)) {
    return { type: "panel", panelKind: BOUNDARY_PANEL_KIND[semanticType] };
  }
  if (hasChildren) {
    return { type: "panel", panelKind: PanelKind.Default };
  }
  return { type: LEAF_COMPONENT_TYPE[semanticType] };
}
