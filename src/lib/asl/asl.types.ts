/**
 * ASL (Architecture as Language) manifest model — the shape declared by the
 * OpenAPI schemas in `/asl/*.yaml`.
 *
 * Every resource follows the Kubernetes-style envelope
 * `apiVersion` / `kind` / `metadata` / `spec`, and a solution is a single
 * multi-document YAML file. This module is the schema half of the importer: it
 * knows what a manifest looks like, not what it becomes on the canvas.
 */

/** The only apiVersion the schemas allow (`manifest.schema.yaml`). */
export const ASL_API_VERSION = "arquitetura.itau/v1";

/** `metadata.name` doubles as the reference key, so its shape is enforced. */
export const ASL_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

export const ASL_KINDS = [
  "APIGateway",
  "Application",
  "ApplicationService",
  "Topic",
  "Queue",
  "Database",
  "BusinessCapability",
  "BusinessService",
  "ServiceOffer",
  "Squad",
  "Community",
  "BusinessRule",
  "Relationship",
] as const;

export type AslKind = (typeof ASL_KINDS)[number];

export function isAslKind(value: unknown): value is AslKind {
  return typeof value === "string" && (ASL_KINDS as readonly string[]).includes(value);
}

export interface AslMetadata {
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AslManifest {
  apiVersion: string;
  kind: AslKind;
  metadata: AslMetadata;
  spec: Record<string, unknown>;
  /** Position of the manifest in the source file, for error reporting. */
  documentIndex: number;
}

/**
 * Required `spec` fields per kind, transcribed from the `required:` list of each
 * `/asl/<kind>.schema.yaml`. A kind absent from a schema file would be a bug in
 * the table, so the record is total over `AslKind`.
 */
export const ASL_REQUIRED_SPEC_FIELDS: Record<AslKind, readonly string[]> = {
  APIGateway: ["provider", "exposure"],
  Application: ["provider", "language", "description"],
  ApplicationService: ["sigla"],
  Topic: ["provider", "type"],
  Queue: ["provider"],
  Database: ["provider"],
  BusinessCapability: ["description"],
  BusinessService: ["description"],
  ServiceOffer: ["description"],
  Squad: ["code"],
  Community: ["code"],
  BusinessRule: ["description", "appliesTo", "constraints"],
  Relationship: ["edges"],
};

export const ASL_RELATIONSHIP_TYPES = [
  "calls",
  "consumes",
  "produces",
  "reads",
  "writes",
  "subscribes",
  "publishes",
  "triggers",
  "appliesTo",
  "belongsTo",
  "relatedTo",
] as const;

export type AslRelationshipType = (typeof ASL_RELATIONSHIP_TYPES)[number];

export function isAslRelationshipType(value: unknown): value is AslRelationshipType {
  return (
    typeof value === "string" && (ASL_RELATIONSHIP_TYPES as readonly string[]).includes(value)
  );
}

/** Composite key `{ kind, id }` pointing at another manifest by `metadata.name`. */
export interface AslEndpointRef {
  kind: string;
  id: string;
}

export interface AslRelationshipEdge {
  from: AslEndpointRef;
  to: AslEndpointRef;
  type: AslRelationshipType;
  description?: string;
}

export interface AslConstraint {
  name: string;
  condition: string;
  error: string;
  action?: string;
}

/**
 * Kinds that describe the business layer. They carry no topology of their own,
 * so the importer draws them as anchored notes rather than as graph nodes.
 */
export const ASL_BUSINESS_KINDS = [
  "BusinessCapability",
  "BusinessService",
  "ServiceOffer",
] as const;

export function isAslBusinessKind(kind: AslKind): boolean {
  return (ASL_BUSINESS_KINDS as readonly string[]).includes(kind);
}

/**
 * Kinds that describe ownership rather than architecture. They have no place on
 * the canvas; the importer reports how many it skipped instead of drawing them.
 */
export const ASL_ORGANIZATION_KINDS = ["Squad", "Community"] as const;

export function isAslOrganizationKind(kind: AslKind): boolean {
  return (ASL_ORGANIZATION_KINDS as readonly string[]).includes(kind);
}

/**
 * Issue codes double as i18n key suffixes (`aslImport.issue.<code>`), so the
 * conversion modules stay free of user-visible strings while still explaining
 * themselves. Blocking codes abort the import; warning codes never do.
 */
export type AslIssueCode =
  // structural — blocking
  | "invalidYaml"
  | "noManifests"
  | "documentNotAnObject"
  | "invalidApiVersion"
  | "invalidKind"
  | "invalidMetadata"
  | "missingName"
  | "invalidName"
  | "duplicateName"
  | "invalidSpec"
  | "missingSpecField"
  | "edgesNotArray"
  | "edgeNotAnObject"
  | "edgeMissingEndpoint"
  | "edgeInvalidType"
  | "edgeEndpointNotFound"
  | "edgeKindMismatch"
  | "containmentCycle"
  // non-blocking
  | "unknownProvider"
  | "skippedOrganizationKinds"
  | "unanchoredNote";

export interface AslIssue {
  code: AslIssueCode;
  /** Interpolation values for the matching i18n message. */
  params?: Record<string, string | number>;
}
