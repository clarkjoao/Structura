/**
 * Architecture IR — the contract between the model and the layout engine.
 *
 * The model describes *intent*: what exists, how it is grouped, what talks to what. It never
 * describes geometry. There is no x, y, width or height anywhere in this schema, and adding
 * one would reintroduce the problem the whole subsystem exists to remove — a language model
 * placing coordinates by hand.
 *
 * Tool parameter schemas are derived from these definitions (see `tool-schema.ts`), so there
 * is no hand-maintained JSON Schema to drift out of sync.
 *
 * Every object here is strict. Zod's default is to strip unknown keys, which would mean a
 * model emitting `x`/`y` gets a silent success and a diagram laid out from intent it thinks
 * it overrode. Strict turns that into a visible schema error the correction loop can act on.
 */

import { z } from "zod";
import { TIER_ORDER } from "@/lib/layout-engine";

/**
 * Layout columns, in reading order. `cross-cutting` is not a column: those services get
 * their own band below the flow, because wiring observability and auth to everything is
 * what turns a diagram into a web.
 */
export const tierSchema = z.enum([
  "external",
  "client",
  "gateway",
  "application",
  "backend",
  "data",
  "cross-cutting",
]);

export type Tier = z.infer<typeof tierSchema>;

export const diagramKindSchema = z.enum(["c4-context", "c4-container", "c4-component", "aws"]);

export type DiagramKind = z.infer<typeof diagramKindSchema>;

export const densityHintSchema = z.enum(["simple", "medium", "complex"]);

export const emphasisSchema = z.enum(["default", "primary", "muted"]);

export const connectionIntentSchema = z.enum([
  "call",
  "async-message",
  "event",
  "data-flow",
  "dependency",
]);

export const boundaryKindSchema = z.enum([
  "system",
  "container",
  "api-group",
  "trust-zone",
  "aws-account",
  "aws-vpc",
  "aws-subnet",
  "swimlane",
]);

/** Stable, human-readable identifier. */
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase kebab-case, e.g. "order-service".');

export const irNodeSchema = z.strictObject({
  id: idSchema.describe("Stable kebab-case identifier, unique across the diagram."),
  /**
   * A Structura ComponentType, used verbatim. Translating between an IR vocabulary and the
   * canvas vocabulary would be pure loss: the catalog is already the right set of names,
   * and using it directly keeps patterns and manual edits compatible.
   */
  type: z
    .string()
    .min(1)
    .describe(
      'Structura component type, e.g. "person", "system", "container", "component", or a cloud type like "aws-compute".',
    ),
  name: z.string().min(1).max(120).describe("Short display name."),
  technology: z
    .string()
    .max(80)
    .optional()
    .describe('Implementation technology, e.g. "Node.js", "PostgreSQL".'),
  description: z.string().max(280).optional().describe("One line on what this element does."),
  tier: tierSchema.describe("Which column this belongs in; drives horizontal placement."),
  aws_service: z
    .string()
    .max(80)
    .optional()
    .describe('Specific AWS service id when type is an AWS category, e.g. "lambda".'),
  emphasis: emphasisSchema
    .optional()
    .describe("Visual weight. Defaults to primary for nodes on the primary path."),
  owner: z.string().max(80).optional().describe("Owning team, if relevant."),
});

export type IrNode = z.infer<typeof irNodeSchema>;

export const irBoundarySchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1).max(120).describe("Boundary label."),
  kind: boundaryKindSchema.describe("What kind of grouping this represents."),
  contains: z
    .array(idSchema)
    .describe("Node ids inside this boundary. A node may belong to only one boundary."),
  parent_boundary_id: idSchema.optional().describe("Enclosing boundary, for nesting."),
  order_index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Visual order among sibling boundaries."),
});

export type IrBoundary = z.infer<typeof irBoundarySchema>;

/**
 * A relationship.
 *
 * Deliberately absent: `crosses_boundary` (the engine derives it from geometry — asking the
 * model would be asking it to reason spatially) and `is_cross_cutting` (that is a property
 * of the node's tier; duplicating it here would allow contradictory states).
 */
export const irConnectionSchema = z.strictObject({
  id: idSchema,
  from: idSchema.describe("Source node id."),
  to: idSchema.describe("Target node id."),
  label: z.string().max(80).optional().describe("Short edge label; omit when obvious."),
  technology: z.string().max(80).optional().describe('Protocol, e.g. "HTTPS", "gRPC", "SQS".'),
  intent: connectionIntentSchema.describe("What kind of relationship this is."),
  is_primary_path: z
    .boolean()
    .optional()
    .describe("Part of the happy path. Inferred from meta.primary_path when omitted."),
  edge_style: z.enum(["solid", "dashed"]).optional().describe('Line style: "solid" (default) or "dashed" (for optional/background flows).'),
});

export type IrConnection = z.infer<typeof irConnectionSchema>;

export const irMetaSchema = z.strictObject({
  title: z.string().min(1).max(160).describe("Diagram title."),
  description: z.string().max(400).optional(),
  cloud: z.enum(["aws", "gcp", "azure", "on-prem", "hybrid"]).optional(),
  tiers: z
    .array(tierSchema)
    .optional()
    .describe("Column order. Defaults to a sensible set for the diagram kind."),
  primary_path: z
    .array(idSchema)
    .optional()
    .describe(
      "Node ids along the happy path, in order. Drives both ordering and emphasis, so it is worth getting right.",
    ),
  density_hint: densityHintSchema
    .optional()
    .describe("Spacing scale. Inferred from node count when omitted."),
});

export const architectureIrSchema = z.strictObject({
  schema_version: z.literal(1),
  diagram_kind: diagramKindSchema,
  meta: irMetaSchema,
  nodes: z.array(irNodeSchema).min(1),
  boundaries: z.array(irBoundarySchema).optional(),
  connections: z.array(irConnectionSchema).optional(),
});

export type ArchitectureIr = z.infer<typeof architectureIrSchema>;

/**
 * Tier order for an IR: explicit if given, otherwise derived from the nodes actually used.
 * `meta.tiers` is an override for when the author needs a specific column order or wants to
 * force an empty column. When absent, the engine uses every tier that has at least one node,
 * in the canonical order — so a c4-container diagram with a "backend" node but no "gateway"
 * node will have a "backend" column and no "gateway" column, without any error.
 */
export function tiersFor(ir: Pick<ArchitectureIr, "meta" | "nodes">): Tier[] {
  if (ir.meta.tiers) return ir.meta.tiers;
  // Derive from nodes: union of tiers in use, ordered canonically.
  const used = new Set<Tier>(ir.nodes.map((n) => n.tier));
  return TIER_ORDER.filter((tier) => used.has(tier));
}

export type ParseSuccess = { ok: true; ir: ArchitectureIr };

export interface ParseFailure {
  ok: false;
  /** Field-level messages, phrased for the model to correct its own output. */
  issues: Array<{ path: string; message: string }>;
}

/**
 * Lenient schema variant used during partial parse. Strips unknown keys from the raw input
 * and applies defaults so the engine can still produce geometry even when the model emits
 * slightly malformed IR.
 */
const lenientArchitectureIrSchema = z.object({
  schema_version: z.union([z.literal(1), z.number()]).default(1),
  diagram_kind: diagramKindSchema.default("c4-container" as const),
  meta: irMetaSchema.optional().default({ title: "Architecture Diagram" }),
  nodes: z.array(irNodeSchema).default([]),
  boundaries: z.array(irBoundarySchema).optional().default([]),
  connections: z.array(irConnectionSchema).optional().default([]),
});

/**
 * Parses untrusted input (a tool call payload) into an IR.
 *
 * Errors are never blocking. The function always tries to return valid IR:
 * 1. Strip unknown keys from input (removes fields the model emitted that are not in schema)
 * 2. Attempt lenient parse with defaults for missing required fields
 * 3. Return valid nodes + connections (collecting schema issues from invalid connections)
 * 4. If no valid nodes at all → return failure with collected issues
 *
 * Semantic errors (unknown node refs, missing nodes) are reported by the structural validator
 * and the layout engine — this function only handles JSON-level schema deviations.
 */
export function parseArchitectureIr(input: unknown): ParseSuccess | ParseFailure {
  if (input === null || input === undefined || typeof input !== "object") {
    return { ok: false, issues: [{ path: "(root)", message: "IR must be an object" }] };
  }

  const stripped = stripUnknownKeys(input);

  // Attempt lenient parse — fills in defaults for missing required fields.
  const lenientResult = lenientArchitectureIrSchema.safeParse(stripped);
  if (!lenientResult.success) {
    // Even the lenient schema failed — try extracting whatever nodes we can.
    return extractFromRawInput(stripped);
  }

  const ir = lenientResult.data;

  // Validate nodes strictly. At least one valid node is required.
  const nodesResult = z.array(irNodeSchema).safeParse(ir.nodes);
  if (!nodesResult.success) {
    // Capture Zod issues from nodes validation for error reporting.
    const nodesIssues = nodesResult.error.issues.map((i) => ({
      path: `nodes.${i.path.join(".")}`,
      message: i.message,
    }));
    // Try extraction as fallback.
    const extracted = extractFromRawInput(stripped, nodesIssues);
    if (extracted.ok) return extracted;
    return { ok: false, issues: nodesIssues };
  }

  // Enforce min(1) explicitly — the lenient schema strips array constraints via defaults.
  if (nodesResult.data.length === 0) {
    const nodesIssues = [{ path: "nodes", message: "At least one node is required." }];
    const extracted = extractFromRawInput(stripped, nodesIssues);
    if (extracted.ok) return extracted;
    return { ok: false, issues: nodesIssues };
  }

  // Validate connections strictly, but collect issues rather than rejecting the whole IR.
  // The engine's structural validator catches semantic issues (unknown refs, etc.).
  const rawConnections = ir.connections ?? [];
  const validConnections: ArchitectureIr["connections"] = [];
  const connectionIssues: Array<{ path: string; message: string }> = [];

  for (let i = 0; i < rawConnections.length; i++) {
    const conn = rawConnections[i]!;
    const result = irConnectionSchema.safeParse(conn);
    if (result.success) {
      validConnections.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        connectionIssues.push({
          path: `connections.${i}.${issue.path.join(".")}`,
          message: issue.message,
        });
      }
    }
  }

  // Assign validated data with explicit cast — TypeScript can't narrow through the conditional.
  (ir as ArchitectureIr).nodes = nodesResult.data as ArchitectureIr["nodes"];
  (ir as ArchitectureIr).connections = validConnections.length > 0 ? validConnections : undefined;

  // If ALL connections were invalid, return partial IR but include the issues.
  if (validConnections.length === 0 && rawConnections.length > 0) {
    return { ok: false, issues: connectionIssues };
  }

  // If there were partial schema issues (connections dropped), still return the valid IR.
  // The structural validator and layout engine will catch any semantic problems.
  return { ok: true, ir: ir as ArchitectureIr };
}

/**
 * Fallback: extract whatever valid nodes/connections we can from raw stripped input.
 * If no valid nodes found, use pre-collected issues.
 */
function extractFromRawInput(
  stripped: unknown,
  fallbackIssues: Array<{ path: string; message: string }> = [],
): ParseSuccess | ParseFailure {
  if (!stripped || typeof stripped !== "object") {
    return { ok: false, issues: [{ path: "(root)", message: "IR must be an object" }] };
  }
  const raw = stripped as Record<string, unknown>;
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawConnections = Array.isArray(raw.connections) ? raw.connections : [];

  const validNodes = rawNodes
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({ result: irNodeSchema.safeParse(item), item }))
    .filter(({ result }) => result.success)
    .map(({ result }) => result.data);

  const validConnections = rawConnections
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({ result: irConnectionSchema.safeParse(item), item }))
    .filter(({ result }) => result.success)
    .map(({ result }) => result.data);

  if (validNodes.length === 0) {
    return {
      ok: false,
      issues: fallbackIssues.length > 0 ? fallbackIssues : [{ path: "nodes", message: "No valid nodes found in IR." }],
    };
  }

  return {
    ok: true,
    ir: {
      schema_version: 1 as const,
      diagram_kind: diagramKindSchema.parse(raw.diagram_kind ?? "c4-container"),
      meta: irMetaSchema.parse(raw.meta ?? { title: "Architecture Diagram" }),
      nodes: validNodes as ArchitectureIr["nodes"],
      connections: validConnections.length > 0 ? (validConnections as ArchitectureIr["connections"]) : undefined,
    },
  };
}

/** Recursively removes unknown keys from a plain object. */
function stripUnknownKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnknownKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripUnknownKeys(v);
    }
    return out;
  }
  return value;
}
