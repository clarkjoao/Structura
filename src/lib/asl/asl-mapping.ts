import type { AslKind, AslRelationshipType } from "./asl.types";
import type { AslComponentType, AslConnectionIntent, AslTransportPreset } from "./asl-plan";

/**
 * ASL vocabulary -> Structura vocabulary.
 *
 * Two tables, both data rather than control flow, so the inverse direction
 * (Structura -> ASL, deliberately out of scope for now) stays a mechanical
 * exercise if it is ever taken on.
 */

export interface AslTypeMapping {
  componentType: AslComponentType;
  cloudService?: string;
}

/** Providers are matched case- and spacing-insensitively. */
function providerKey(provider: string): string {
  return provider.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * A provider that names no service in Structura's catalogs degrades to a plain
 * C4 container carrying the provider as its technology.
 *
 * Reaching for a lookalike would be worse than having no icon: `mq` in the AWS
 * catalog is *Amazon* MQ and `msk` is *Amazon* MSK, so using them for IBM MQ or
 * for plain Kafka would state something about the architecture that the
 * manifest never said.
 */
const GENERIC: AslTypeMapping = { componentType: "container" };

const PROVIDER_TABLE: Partial<Record<AslKind, Record<string, AslTypeMapping>>> = {
  Application: {
    lambda: { componentType: "aws-compute", cloudService: "lambda" },
    ecs: { componentType: "aws-compute", cloudService: "ecs" },
    eks: { componentType: "aws-compute", cloudService: "eks" },
    openshift: GENERIC,
    vm: GENERIC,
  },
  Database: {
    dynamodb: { componentType: "aws-database", cloudService: "dynamodb" },
    auroramysql: { componentType: "aws-database", cloudService: "aurora" },
    aurorapostgres: { componentType: "aws-database", cloudService: "aurora" },
    rdsmysql: { componentType: "aws-database", cloudService: "rds" },
    rdspostgres: { componentType: "aws-database", cloudService: "rds" },
    neptune: { componentType: "aws-database", cloudService: "neptune" },
    cosmosdb: { componentType: "azure-database", cloudService: "cosmosdb" },
  },
  Queue: {
    sqs: { componentType: "aws-integration", cloudService: "sqs" },
    "ibm mq": GENERIC,
  },
  Topic: {
    sns: { componentType: "aws-integration", cloudService: "sns" },
    kafka: GENERIC,
  },
  APIGateway: {
    "aws api gateway": { componentType: "aws-networking", cloudService: "api-gateway" },
    "kong on-premise": GENERIC,
  },
};

export interface ProviderMappingResult {
  mapping: AslTypeMapping;
  /** True when the provider is not in the schema enum — the caller warns. */
  unknownProvider: boolean;
}

/**
 * Resolves `(kind, provider)` to a component type. An unrecognised provider is
 * never fatal: it degrades to a container and the caller reports it, because a
 * manifest with an unexpected provider still describes a node that renders
 * perfectly.
 */
export function mapProvider(kind: AslKind, provider: string | undefined): ProviderMappingResult {
  const table = PROVIDER_TABLE[kind];
  if (!table) {
    return { mapping: GENERIC, unknownProvider: false };
  }
  const mapping = provider !== undefined ? table[providerKey(provider)] : undefined;
  if (!mapping) {
    return { mapping: GENERIC, unknownProvider: true };
  }
  return { mapping, unknownProvider: false };
}

/** True when the provider resolved to a real catalog service (so it has an icon). */
export function hasCloudService(mapping: AslTypeMapping): boolean {
  return mapping.cloudService !== undefined;
}

export interface RelationshipMapping {
  intent: AslConnectionIntent;
  transportPreset?: AslTransportPreset;
}

/**
 * Relationship types that are *not* flow.
 *
 * `belongsTo` is containment and `appliesTo` is annotation. Drawing either as a
 * normal edge would put a non-flow line into the graph ELK minimises crossings
 * against, degrading the layout in exchange for a line that says nothing about
 * how the system runs.
 */
const NON_FLOW_TYPES = new Set<AslRelationshipType>(["belongsTo", "appliesTo"]);

export function isFlowRelationship(type: AslRelationshipType): boolean {
  return !NON_FLOW_TYPES.has(type);
}

const RELATIONSHIP_TABLE: Record<AslRelationshipType, RelationshipMapping | null> = {
  calls: { intent: "call", transportPreset: "sync" },
  reads: { intent: "data-flow", transportPreset: "sync" },
  writes: { intent: "data-flow", transportPreset: "sync" },
  produces: { intent: "event", transportPreset: "event" },
  publishes: { intent: "event", transportPreset: "event" },
  consumes: { intent: "async-message", transportPreset: "async" },
  subscribes: { intent: "async-message", transportPreset: "async" },
  triggers: { intent: "event", transportPreset: "event" },
  relatedTo: { intent: "dependency" },
  // Not flow: handled as containment and as note anchoring respectively.
  belongsTo: null,
  appliesTo: null,
};

export function mapRelationship(type: AslRelationshipType): RelationshipMapping | null {
  return RELATIONSHIP_TABLE[type];
}

/**
 * Kinds that become graph nodes. `Relationship` is the graph itself, the
 * business kinds become notes, and the organisation kinds are not topology.
 */
export function isDrawableAsNode(kind: AslKind): boolean {
  return (
    kind === "Application" ||
    kind === "Database" ||
    kind === "Queue" ||
    kind === "Topic" ||
    kind === "APIGateway" ||
    kind === "ApplicationService"
  );
}
