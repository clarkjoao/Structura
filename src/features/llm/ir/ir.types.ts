/**
 * Intermediate Representation for LLM-generated diagrams (spec §4).
 *
 * The IR is the contract between the generator prompt and everything downstream:
 * validator, layout, and canvas application. It is deliberately independent of
 * Structura's own component model — the translation happens in `ir-to-component`.
 *
 * AWS *category* semanticTypes are derived from the AWS catalog category list
 * (same ids the element registry registers for family `"aws"` — F5c). Boundary
 * types and C4 remain IR concepts, not registry categories. Expanding the IR
 * vocabulary to GCP/Azure is a product decision, not an automatic consequence
 * of reading from the registry.
 *
 * Category ids come from `AWS_CATEGORIES` (not `allElements()` at module load):
 * the LLM feature is a separate Vite chunk, and a load-time registry snapshot
 * there can miss the host's registrations and reject every `aws-compute` IR in
 * production while vitest still passes.
 */

import {
  AWS_CATEGORIES,
  isAwsType,
  type AwsCategoryId,
} from "@/features/cloud/providers/aws/aws.catalog";

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

/**
 * Semantic types that are boundaries by definition — the type itself already
 * declares the node is a container, so `isBoundary` is implied for them.
 *
 * These are IR concepts, not AWS catalog / registry category ids.
 */
export const IR_BOUNDARY_SEMANTIC_TYPES = [
  "aws-vpc",
  "aws-az",
  "aws-subnet",
  "aws-public-subnet",
  "aws-private-subnet",
] as const;

export type BoundarySemanticType = (typeof IR_BOUNDARY_SEMANTIC_TYPES)[number];

/**
 * AWS category ids that are also IR semanticTypes.
 *
 * Sourced from `AWS_CATEGORIES` (static catalog) so the LLM chunk does not
 * depend on element-registry bootstrap timing. `ir.types.test.ts` locks this
 * list to the registered AWS family so the two cannot drift.
 */
export function irAwsCategoryIdsFromRegistry(): readonly AwsCategoryId[] {
  return AWS_CATEGORIES.map((category) => category.id).filter(isAwsType);
}

/**
 * Boundary types first, then one per AWS catalog category.
 *
 * Built via `irAwsCategoryIdsFromRegistry()` on each call (cheap) so callers
 * never hold a stale allowlist across hot reloads in tests.
 */
export function getIrAwsSemanticTypes(): readonly (BoundarySemanticType | AwsCategoryId)[] {
  return [...IR_BOUNDARY_SEMANTIC_TYPES, ...irAwsCategoryIdsFromRegistry()];
}

export function getIrSemanticTypes(): readonly SemanticType[] {
  return [...IR_C4_SEMANTIC_TYPES, ...getIrAwsSemanticTypes()];
}

export type SemanticType =
  (typeof IR_C4_SEMANTIC_TYPES)[number] | BoundarySemanticType | AwsCategoryId;

/**
 * Semantic position of a node. Carried through the pipeline but not acted upon:
 * the tier-ordering mechanism is an open decision (spec §8, Fatia 4).
 */
export const IR_TIERS = ["external", "edge", "ingress", "compute", "data", "integration"] as const;

export type Tier = (typeof IR_TIERS)[number];

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
  return typeof value === "string" && (getIrSemanticTypes() as readonly string[]).includes(value);
}

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (IR_TIERS as readonly string[]).includes(value);
}

/**
 * Default tier per semanticType — the runtime fallback when the model supplied
 * one that is not in the vocabulary, and the table the generator prompt shows.
 * It is a total record on purpose: both readers then cover every type, and the
 * prompt cannot teach a default the validator would not have picked.
 *
 * The mapping is only as good as the vocabulary is: `IR_TIERS` describes a
 * *position in the left-to-right flow*, and cross-cutting categories — security,
 * observability, governance, developer tooling — do not have one. Models reach
 * for "security", "monitoring" and "analytics" precisely because the IR teaches
 * those words as semanticTypes while forbidding them here.
 *
 * Until the tier mechanism is designed (spec §8), those land on "compute" for
 * want of anywhere better. Nothing reads `tier` yet, so this normalization
 * cannot misplace a node today — but whoever implements tier ordering should
 * treat a cross-cutting node's tier as unset rather than as a real position.
 */
export const TIER_BY_SEMANTIC_TYPE: Record<SemanticType, Tier> = {
  person: "external",
  "external-system": "external",
  container: "compute",
  database: "data",
  component: "compute",

  // Boundaries have no position of their own; they take the one of the traffic
  // they front, which is what the worked examples in the prompt show.
  "aws-vpc": "edge",
  "aws-az": "compute",
  "aws-subnet": "compute",
  "aws-public-subnet": "edge",
  "aws-private-subnet": "compute",

  "aws-compute": "compute",
  "aws-storage": "data",
  "aws-database": "data",
  "aws-networking": "ingress",
  "aws-security": "compute",
  "aws-analytics": "data",
  "aws-ml": "compute",
  "aws-integration": "integration",
  "aws-management": "compute",
  "aws-developer": "compute",
  "aws-containers": "compute",
  "aws-media": "compute",
  "aws-migration": "integration",
  "aws-iot": "edge",
  "aws-end-user": "edge",
  "aws-general": "compute",
};

/** The node's tier when it gave a usable one, else the closest fit for its type. */
export function coerceTier(value: unknown, semanticType: SemanticType): Tier {
  if (isTier(value)) return value;
  return TIER_BY_SEMANTIC_TYPE[semanticType];
}
