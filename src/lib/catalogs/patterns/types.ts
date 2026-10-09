import type { ComponentType } from "@/features/diagram/model/component.types";
import type { ElementCreateOptions } from "@/features/elements/element.types";
import type { CatalogConceptId } from "@/features/elements/search/concepts";

/**
 * Pattern categories, in the order the browser lists them. Labels live in
 * i18n (`patterns.category.<id>`).
 */
export const PATTERN_CATEGORIES = [
  "integration-messaging",
  "api-edge",
  "data-consistency",
  "resilience",
  "migration-modernization",
  "deployment-scale",
  "security-identity",
  "structure",
] as const;

export type PatternCategory = (typeof PATTERN_CATEGORIES)[number];

/**
 * An infrastructure job a node does — queue, cache, CDN… It is a catalog
 * concept: with a provider chosen at insert time it becomes that family's
 * service for the concept (`serviceForConcept`), and a neutral container
 * otherwise. Application services ("Order Service") have no role.
 */
export type PatternRole = CatalogConceptId;

/**
 * Edge labels, shared by every pattern so each is translated once
 * (`patterns.edges.<id>`).
 */
export const PATTERN_EDGE_LABELS = [
  "request",
  "route",
  "call",
  "forward",
  "publish",
  "deliver",
  "enqueue",
  "consume",
  "pipe",
  "scatter",
  "store-payload",
  "send-reference",
  "fetch-payload",
  "write",
  "read",
  "read-write",
  "write-status",
  "read-status",
  "poll-status",
  "command",
  "query",
  "append",
  "stream-events",
  "project",
  "change-events",
  "poll-outbox",
  "command-compensate",
  "persist-state",
  "emit-event",
  "read-or-populate",
  "read-on-miss",
  "persist",
  "replicate",
  "route-by-key",
  "serve-static",
  "origin-fetch",
  "resolve",
  "failover",
  "live-traffic",
  "switch-on-release",
  "majority-traffic",
  "canary-traffic",
  "metrics",
  "route-legacy",
  "route-migrated",
  "translate",
  "sign-in",
  "issue-token",
  "request-key",
  "upload-direct",
  "check-policy",
  "load-policies",
  "forward-if-allowed",
  "localhost",
  "telemetry",
  "proxy",
  "mtls",
  "configure",
  "call-port",
  "invoke",
  "route-by-tenant",
  "route-critical",
  "route-batch",
] as const;

export type PatternEdgeLabel = (typeof PATTERN_EDGE_LABELS)[number];

/**
 * One node, placed on the pattern's grid (one cell per node, see
 * `PATTERN_CELL_W/H`). Its label is `patterns.items.<pattern>.nodes.<key>`.
 */
export interface PatternNode {
  /** Stable within the pattern: edges and children name it. */
  key: string;
  /** Infrastructure role, resolved per provider. Exclusive with `type`. */
  role?: PatternRole;
  /** The element otherwise; absent with no role means a C4 container. */
  type?: ComponentType;
  createOptions?: ElementCreateOptions;
  /** Key of the boundary that contains it; that node is sized to fit its children. */
  parent?: string;
  col: number;
  row: number;
}

export interface PatternEdge {
  from: string;
  to: string;
  label: PatternEdgeLabel;
}

/** Where to read about a pattern, per locale; `en` is the fallback. */
export interface PatternReferences {
  en: string;
  "pt-BR"?: string;
}

/**
 * A built-in architecture pattern: a fragment inserted on the current canvas.
 * Name and description are `patterns.items.<id>.name|description`.
 */
export interface PatternTemplate {
  id: string;
  category: PatternCategory;
  nodes: readonly PatternNode[];
  edges: readonly PatternEdge[];
  references: PatternReferences;
}
