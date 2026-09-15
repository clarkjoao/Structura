// Leaf imports rather than the `@/features/diagram` barrel: this module is pure
// mapping, and going through the barrel would drag the whole store in with it.
import { PanelKind } from "@/features/diagram/enums";
import type { ComponentType } from "@/features/diagram/model/component.types";
import { isAwsType } from "@/features/cloud/providers/aws/aws.catalog";
import { cloudServiceIdWrite } from "@/features/diagram/model/cloud-service-id";
import { getPanelKindForAwsService } from "@/lib/catalogs/panels";
import {
  IR_C4_SEMANTIC_TYPES,
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
 * Leaf mapping for C4. Note "database": Structura's C4 model has no database
 * type, so it degrades to a container — the technology field carries the engine.
 *
 * AWS category semanticTypes map to themselves via `isAwsType`: they are the
 * same ids the element registry owns (F5b), and the canvas picks the icon from
 * `cloudServiceId` (mapped from IR `awsService` at apply time).
 */
const C4_LEAF_COMPONENT_TYPE: Record<(typeof IR_C4_SEMANTIC_TYPES)[number], ComponentType> = {
  person: "person",
  "external-system": "system",
  container: "container",
  database: "container",
  component: "component",
};

function leafComponentType(
  semanticType: Exclude<SemanticType, BoundarySemanticType>,
): ComponentType {
  if (isAwsType(semanticType)) {
    return semanticType;
  }
  return C4_LEAF_COMPONENT_TYPE[semanticType];
}

export interface MappedComponentType {
  type: ComponentType;
  panelKind?: PanelKind;
  /** Passed through so the canvas can resolve its icon (`cloudServiceId`). */
  cloudServiceId?: string;
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
 * type and carry `cloudServiceId` (from IR `awsService`) for the service icon.
 */
export function mapNodeToComponent(
  node: Pick<IRNode, "semanticType" | "awsService" | "isBoundary">,
): MappedComponentType {
  const { semanticType, awsService } = node;
  if (node.isBoundary === true || isBoundarySemanticType(semanticType)) {
    return { type: "panel", panelKind: panelKindFor(semanticType, awsService) };
  }
  return {
    type: leafComponentType(semanticType),
    ...cloudServiceIdWrite(awsService),
  };
}
