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

export interface IRNode {
  /** lowercase-hyphenated, unique within the IR */
  id: string;
  semanticType: SemanticType;
  name: string;
  technology?: string;
  /** containment hierarchy; null for a root node */
  parentId: string | null;
  tier: Tier;
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
