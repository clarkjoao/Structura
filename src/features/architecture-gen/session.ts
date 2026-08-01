/**
 * Proposal session — the propose / refine / commit loop.
 *
 * Proposing and committing are separate on purpose. The old surface mutated the store on
 * every `add_node`, so a diagram was already half-built before anything could check it, and
 * three rounds of correction meant three partial diagrams on the canvas. Here a proposal
 * produces geometry and diagnostics without touching the store; only `commit` applies it.
 *
 * The loop is capped at MAX_ROUNDS and additionally stops when it stops improving: two
 * consecutive rounds that fail to beat the best error count mean the model is circling, and
 * more rounds only cost tokens.
 */

import { layoutDiagram, type LayoutResult, type MeasureText } from "@/lib/layout-engine";
import {
  validateGeometry,
  validateIr,
  type Diagnostic,
  type ValidationReport,
} from "@/lib/validators";
import { parseArchitectureIr, toLayoutInput, toStructuralInput } from "./ir";
import type { ArchitectureIr } from "./ir";

/** Hard cap on correction rounds. */
export const MAX_ROUNDS = 3;

/** Consecutive non-improving rounds tolerated before the loop gives up. */
export const STALL_LIMIT = 2;

export type ProposalStatus =
  | "ok"
  | "schema-invalid"
  | "structurally-invalid"
  | "layout-failed"
  | "has-errors"
  | "has-warnings";

export interface ProposalResult {
  status: ProposalStatus;
  /** True when the proposal is good enough to commit. */
  committable: boolean;
  round: number;
  diagnostics: Diagnostic[];
  errors: number;
  warnings: number;
  readabilityScore: number;
  /** Counts only — never coordinates. The model has no use for geometry. */
  preview?: {
    nodeCount: number;
    edgeCount: number;
    boundaryCount: number;
    tiersUsed: string[];
  };
  /** Set when the loop should stop even though problems remain. */
  exhausted?: { reason: "max-rounds" | "no-improvement"; roundsUsed: number };
}

interface Round {
  ir: ArchitectureIr;
  /** Absent when the round failed before the engine ran. */
  layout?: LayoutResult;
  report: ValidationReport;
  errors: number;
}

export interface SessionOptions {
  measureText?: MeasureText;
}

/**
 * Holds the rounds for one diagram request. Instances are cheap; create one per user
 * request rather than sharing across conversations.
 */
export class ProposalSession {
  private readonly rounds: Round[] = [];
  private bestErrors = Number.POSITIVE_INFINITY;
  private stalls = 0;

  constructor(private readonly options: SessionOptions = {}) {}

  get roundCount(): number {
    return this.rounds.length;
  }

  /** Last proposal good enough to commit, if any. */
  get committable(): Round | undefined {
    for (let i = this.rounds.length - 1; i >= 0; i -= 1) {
      const round = this.rounds[i]!;
      if (round.layout?.ok && round.errors === 0) return round;
    }
    return undefined;
  }

  /**
   * Validates, lays out and validates again — without touching the store.
   * Accepts unknown so it can take a raw tool payload.
   */
  propose(input: unknown): ProposalResult {
    const parsed = parseArchitectureIr(input);
    if (!parsed.ok) {
      return {
        status: "schema-invalid",
        committable: false,
        round: this.rounds.length,
        diagnostics: parsed.issues.map((issue) => ({
          code: "ir/schema",
          severity: "error" as const,
          message: `${issue.path || "(root)"}: ${issue.message}`,
          subject: { kind: "node" as const, ids: [] },
          supportedFixes: [
            {
              action: "rename-id" as const,
              description: `Correct "${issue.path || "the payload"}" and resend.`,
            },
          ],
        })),
        errors: parsed.issues.length,
        warnings: 0,
        readabilityScore: 0,
      };
    }

    const ir = parsed.ir;

    // Structural checks first: an unknown id makes every geometric finding meaningless,
    // and this costs microseconds compared to running the engine.
    const structural = validateIr(toStructuralInput(ir));
    if (structural.errors > 0) {
      return this.record(ir, undefined, structural, "structurally-invalid");
    }

    const layout = layoutDiagram(toLayoutInput(ir), { measureText: this.options.measureText });
    if (!layout.ok && layout.failures.length > 0) {
      const report: ValidationReport = {
        diagnostics: layout.failures.map((failure) => ({
          code: failure.code,
          severity: "error" as const,
          message: failure.message,
          subject: { kind: "node" as const, ids: failure.nodeIds ?? [] },
          supportedFixes: [
            {
              action: "drop-edge" as const,
              description: "Remove or correct the elements named above, then resend.",
            },
          ],
        })),
        errors: layout.failures.length,
        warnings: 0,
        readability: { throughVertexRoutes: 0, edgeCrossings: 0, totalEdgeLength: 0, score: 0 },
      };
      return this.record(ir, layout, report, "layout-failed");
    }

    const geometric = validateGeometry(layout.state);
    const combined: ValidationReport = {
      diagnostics: [...structural.diagnostics, ...geometric.diagnostics],
      errors: structural.errors + geometric.errors,
      warnings: structural.warnings + geometric.warnings,
      readability: geometric.readability,
    };

    const status: ProposalStatus =
      combined.errors > 0 ? "has-errors" : combined.warnings > 0 ? "has-warnings" : "ok";

    return this.record(ir, layout, combined, status);
  }

  /** Alias for `propose`, for the refine tool. Round accounting is identical. */
  refine(input: unknown): ProposalResult {
    return this.propose(input);
  }

  /** Geometry of the committable proposal, for the caller to apply to the store. */
  commit(): LayoutResult | undefined {
    return this.committable?.layout;
  }

  private record(
    ir: ArchitectureIr,
    layout: LayoutResult | undefined,
    report: ValidationReport,
    status: ProposalStatus,
  ): ProposalResult {
    const errors = report.errors;

    this.rounds.push({ ir, layout, report, errors });

    if (errors < this.bestErrors) {
      this.bestErrors = errors;
      this.stalls = 0;
    } else {
      this.stalls += 1;
    }

    const round = this.rounds.length;
    const committable = status === "ok" || status === "has-warnings";

    let exhausted: ProposalResult["exhausted"];
    if (!committable) {
      if (round >= MAX_ROUNDS) {
        exhausted = { reason: "max-rounds", roundsUsed: round };
      } else if (this.stalls >= STALL_LIMIT) {
        exhausted = { reason: "no-improvement", roundsUsed: round };
      }
    }

    return {
      status,
      committable,
      round,
      diagnostics: report.diagnostics,
      errors,
      warnings: report.warnings,
      readabilityScore: report.readability.score,
      preview: layout?.state
        ? {
            nodeCount: layout.state.nodes.size,
            edgeCount: layout.state.connections.length,
            boundaryCount: layout.state.boundaries.size,
            tiersUsed: [...new Set([...layout.state.nodes.values()].map((node) => node.tier))],
          }
        : undefined,
      exhausted,
    };
  }
}
