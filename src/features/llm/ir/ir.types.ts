/**
 * Intermediate Representation for LLM-generated diagrams (spec §4).
 *
 * The IR is the contract between the generator prompt and everything downstream:
 * validator, layout, and canvas application. It is deliberately independent of
 * Structura's own component model — the translation happens in `ir-to-component`.
 */

export const IR_DIAGRAM_TYPES = [
  "c4-context",
  "c4-container",
  "c4-component",
  "aws-deployment",
] as const;

export type IRDiagramType = (typeof IR_DIAGRAM_TYPES)[number];

export const IR_C4_SEMANTIC_TYPES = [
  "person",
  "external-system",
  "container",
  "database",
  "component",
] as const;

export const IR_AWS_SEMANTIC_TYPES = [
  "aws-vpc",
  "aws-az",
  "aws-subnet",
  "aws-public-subnet",
  "aws-private-subnet",
  "aws-compute",
  "aws-database",
  "aws-storage",
  "aws-networking",
  "aws-security",
  "aws-integration",
  "aws-management",
] as const;

export const IR_SEMANTIC_TYPES = [...IR_C4_SEMANTIC_TYPES, ...IR_AWS_SEMANTIC_TYPES] as const;

export type SemanticType = (typeof IR_SEMANTIC_TYPES)[number];

/**
 * Semantic position of a node. Carried through the pipeline but not acted upon:
 * the tier-ordering mechanism is an open decision (spec §8, Fatia 4).
 */
export const IR_TIERS = ["external", "edge", "ingress", "compute", "data", "integration"] as const;

export type Tier = (typeof IR_TIERS)[number];

/**
 * Semantic types that are boundaries by definition — the type itself already
 * declares the node is a container, so `isBoundary` is implied for them.
 */
export const IR_BOUNDARY_SEMANTIC_TYPES = [
  "aws-vpc",
  "aws-az",
  "aws-subnet",
  "aws-public-subnet",
  "aws-private-subnet",
] as const;

export type BoundarySemanticType = (typeof IR_BOUNDARY_SEMANTIC_TYPES)[number];

export function isBoundarySemanticType(value: SemanticType): value is BoundarySemanticType {
  return (IR_BOUNDARY_SEMANTIC_TYPES as readonly string[]).includes(value);
}

export interface IRNode {
  /** lowercase-hyphenated, unique within the IR */
  id: string;
  semanticType: SemanticType;
  name: string;
  technology?: string;
  /**
   * Concrete cloud service behind the semanticType — "lambda", "rds", "alb".
   * Resolved against Structura's AWS catalog for iconography; an unknown value
   * degrades to the category icon rather than failing.
   */
  awsService?: string;
  /** containment hierarchy; null for a root node */
  parentId: string | null;
  /**
   * Marks the node as a container. A boundary may hold children or stand empty
   * (an unpopulated VPC is still a VPC); a node that is not a boundary must not
   * have children.
   */
  isBoundary?: boolean;
  tier: Tier;
}

/** True when the node is a container, by explicit flag or by semanticType. */
export function isBoundaryNode(node: Pick<IRNode, "semanticType" | "isBoundary">): boolean {
  return node.isBoundary === true || isBoundarySemanticType(node.semanticType);
}

export interface IREdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface DiagramIR {
  type: IRDiagramType;
  nodes: IRNode[];
  edges: IREdge[];
}

export function isIRDiagramType(value: unknown): value is IRDiagramType {
  return typeof value === "string" && (IR_DIAGRAM_TYPES as readonly string[]).includes(value);
}

export function isSemanticType(value: unknown): value is SemanticType {
  return typeof value === "string" && (IR_SEMANTIC_TYPES as readonly string[]).includes(value);
}

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (IR_TIERS as readonly string[]).includes(value);
}

/**
 * Best tier for a semanticType, used when the model supplied one that is not in
 * the vocabulary. The mapping is only as good as the vocabulary is: `IR_TIERS`
 * describes a *position in the left-to-right flow*, and cross-cutting services —
 * security, observability, cost management — do not have one. Models reach for
 * "security" and "management" precisely because the IR teaches those words as
 * semanticTypes (`aws-security`, `aws-management`) while forbidding them here.
 *
 * Until the tier mechanism is designed (spec §8), those land on "compute" for
 * want of anywhere better. Nothing reads `tier` yet, so this normalization
 * cannot misplace a node today — but whoever implements tier ordering should
 * treat a cross-cutting node's tier as unset rather than as a real position.
 */
const TIER_BY_SEMANTIC_TYPE: Partial<Record<SemanticType, Tier>> = {
  person: "external",
  "external-system": "external",
  database: "data",
  "aws-database": "data",
  "aws-storage": "data",
  "aws-networking": "ingress",
  "aws-integration": "integration",
};

/** The node's tier when it gave a usable one, else the closest fit for its type. */
export function coerceTier(value: unknown, semanticType: SemanticType): Tier {
  if (isTier(value)) return value;
  return TIER_BY_SEMANTIC_TYPE[semanticType] ?? "compute";
}
