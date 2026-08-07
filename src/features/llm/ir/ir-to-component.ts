// Leaf imports rather than the `@/features/diagram` barrel: this module is pure
// mapping, and going through the barrel would drag the whole store in with it.
import { PanelKind } from "@/features/diagram/enums";
import type { ComponentType } from "@/features/diagram/model/component.types";
import { getPanelKindForAwsService } from "@/lib/catalogs/panels";
import {
  isBoundarySemanticType,
  type BoundarySemanticType,
  type IRNode,
  type SemanticType,
} from "./ir.types";

/** Fallback panel kind per boundary semanticType, when no service pins it down. */
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
  /** Passed through to the component so the canvas can resolve its icon. */
  awsService?: string;
}

/**
 * Panel kind for a boundary. The concrete service wins when Structura knows it
 * (`ecs` -> ECS Cluster, `private-subnet` -> Private Subnet), because it names
 * the actual thing; otherwise the semanticType decides.
 */
function panelKindFor(semanticType: SemanticType, awsService: string | undefined): PanelKind {
  const fromService = awsService ? getPanelKindForAwsService(awsService) : undefined;
  if (fromService) {
    return fromService;
  }
  if (isBoundarySemanticType(semanticType)) {
    return BOUNDARY_PANEL_KIND[semanticType];
  }
  return PanelKind.Default;
}

/**
 * Translates an IR node into a Structura component type.
 *
 * Boundaries become panels because React Flow only nests a node visually when
 * its parent is a panel (see `computeNodeVisibility`) — that is also how a C4
 * system boundary or an AWS VPC is drawn here. Leaf nodes keep their natural
 * type and carry `awsService` so the canvas can pick the service icon.
 */
export function mapNodeToComponent(
  node: Pick<IRNode, "semanticType" | "awsService" | "isBoundary">,
): MappedComponentType {
  const { semanticType, awsService } = node;
  if (node.isBoundary === true || isBoundarySemanticType(semanticType)) {
    return { type: "panel", panelKind: panelKindFor(semanticType, awsService) };
  }
  return {
    type: LEAF_COMPONENT_TYPE[semanticType],
    ...(awsService !== undefined ? { awsService } : {}),
  };
}
