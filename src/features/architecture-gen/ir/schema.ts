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

/**
 * Default tier order per diagram kind.
 *
 * A C4 context diagram is people and systems; a container diagram adds the inside of one
 * system; an AWS diagram spans the full stack. Giving each kind its own default keeps the
 * model from having to reason about columns it will never populate — and empty tiers
 * collapse anyway, so a wrong guess costs layout nothing.
 */
export const DEFAULT_TIERS: Record<DiagramKind, Tier[]> = {
  "c4-context": ["external", "application", "cross-cutting"],
  "c4-container": ["external", "client", "gateway", "application", "data", "cross-cutting"],
  "c4-component": ["gateway", "application", "backend", "data", "cross-cutting"],
  aws: ["external", "client", "gateway", "application", "backend", "data", "cross-cutting"],
};

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

/** Tier order for an IR: explicit if given, else the default for its kind. */
export function tiersFor(ir: Pick<ArchitectureIr, "diagram_kind" | "meta">): Tier[] {
  return ir.meta.tiers ?? DEFAULT_TIERS[ir.diagram_kind];
}

export interface ParseSuccess {
  ok: true;
  ir: ArchitectureIr;
}

export interface ParseFailure {
  ok: false;
  /** Field-level messages, phrased for the model to correct its own output. */
  issues: Array<{ path: string; message: string }>;
}

/**
 * Parses untrusted input (a tool call payload) into an IR.
 * Schema failures are returned, not thrown — they are part of the correction loop.
 */
export function parseArchitectureIr(input: unknown): ParseSuccess | ParseFailure {
  const result = architectureIrSchema.safeParse(input);
  if (result.success) return { ok: true, ir: result.data };

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
