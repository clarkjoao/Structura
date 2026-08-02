/**
 * Executes the architecture tool calls.
 *
 * Owns the proposal session for one conversation and routes the three tools. Only
 * `commit_architecture` reaches the store; propose and refine are pure, which is what lets
 * the model iterate without leaving partial diagrams behind.
 */

import { useDiagramStore } from "@/features/diagram";
import { resolveMeasureText } from "@/lib/layout-engine";
import type { Diagnostic } from "@/lib/validators";
import type {
  ArchitectureApplyResult,
  ArchitecturePayload,
} from "@/features/diagram/store/slices/architecture.slice";
import { toStorePayload } from "./commit";
import { ProposalSession, type ProposalResult } from "./session";
import {
  findPattern,
  expandPattern,
  listPatterns,
  type PatternExpandOptions,
} from "./ir/patterns-bridge";
import type { Tier } from "./ir/schema";

/** The one store capability this executor needs. Injected so tests use an isolated store. */
export type ApplyArchitecture = (payload: ArchitecturePayload) => ArchitectureApplyResult;

export interface ArchitectureToolResult {
  tool: string;
  ok: boolean;
  /** Written for the model: what happened and what to do next. */
  summary: string;
  diagnostics: Diagnostic[];
  proposal?: ProposalResult;
  applied?: { nodeCount: number; connectionCount: number };
  /** True if commit_architecture was called successfully. */
  committed?: boolean;
  /** For expand_pattern: the generated IR fragment, ready to merge. */
  patternExpansion?: {
    patternId: string;
    patternName: string;
    nodes: { id: string; type: string; name: string; tier: Tier }[];
    connections: { id: string; from: string; to: string; label?: string; intent: string }[];
    indexToId: Record<number, string>;
  };
}

/** Compact diagnostic rendering — the model reads this, so it names elements and fixes. */
function describe(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .slice(0, 10)
    .map((diagnostic) => {
      const fixes = diagnostic.supportedFixes.map((fix) => fix.description).join(" | ");
      return `- [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}${
        fixes ? ` -> ${fixes}` : ""
      }`;
    })
    .join("\n");
}

function summarise(result: ProposalResult): string {
  const header =
    `Round ${result.round}: ${result.errors} error(s), ${result.warnings} warning(s), ` +
    `readability ${result.readabilityScore}.`;

  if (result.status === "ok") {
    return `${header} Clean — call commit_architecture to apply it.`;
  }

  if (result.committable) {
    return (
      `${header} No errors, so this can be committed as-is; fix the warnings first if they ` +
      `matter.\n${describe(result.diagnostics)}`
    );
  }

  const exhausted = result.exhausted
    ? `\nStopping after ${result.exhausted.roundsUsed} round(s) (${result.exhausted.reason}). ` +
      `Report the remaining problems to the user rather than retrying.`
    : `\nApply the fixes above and call refine_architecture.`;

  return `${header}\n${describe(result.diagnostics)}${exhausted}`;
}

/**
 * One instance per conversation. The session accumulates rounds, which is what the
 * improvement rule needs to see.
 */
export class ArchitectureToolExecutor {
  private session: ProposalSession;
  private readonly applyArchitecture: ApplyArchitecture;
  private _committed = false;

  constructor(applyArchitecture?: ApplyArchitecture) {
    // Canvas-backed measurement in the browser, deterministic approximation elsewhere.
    this.session = new ProposalSession({ measureText: resolveMeasureText() });
    this.applyArchitecture =
      applyArchitecture ?? ((payload) => useDiagramStore.getState().applyArchitecture(payload));
  }

  /** True when a proposal has passed validation and can be committed. */
  get committable(): boolean {
    return this.session.committable !== undefined;
  }

  /** True when the last call was a successful commit. */
  get wasCommitted(): boolean {
    return this._committed;
  }

  /** Starts a fresh session — call when the user asks for a different diagram. */
  reset(): void {
    this.session = new ProposalSession({ measureText: resolveMeasureText() });
    this._committed = false;
  }

  /**
   * Applies the committable proposal to the diagram store. Idempotent — calling again
   * after the first successful commit is a no-op.
   */
  commit(): ArchitectureToolResult {
    const layout = this.session.commit();
    if (!layout?.state) {
      return {
        tool: "commit_architecture",
        ok: false,
        summary:
          "Nothing to commit: no proposal has passed validation yet. Call propose_architecture first.",
        diagnostics: [],
      };
    }
    if (this._committed) {
      return {
        tool: "commit_architecture",
        ok: true,
        summary: "Already committed — this session's proposal is already on the canvas.",
        diagnostics: [],
        committed: false,
      };
    }

    const payload = toStorePayload(layout.state);
    const result = this.applyArchitecture(payload);
    this._committed = true;

    return {
      tool: "commit_architecture",
      ok: true,
      summary:
        `Committed ${result.createdNodeIds.length} node(s) and ` +
        `${result.createdConnectionIds.length} connection(s) to the canvas.`,
      diagnostics: [],
      committed: true,
      applied: {
        nodeCount: result.createdNodeIds.length,
        connectionCount: result.createdConnectionIds.length,
      },
    };
  }

  execute(tool: string, parameters: Record<string, unknown>): ArchitectureToolResult {
    switch (tool) {
      case "propose_architecture":
      case "refine_architecture": {
        const result = this.session.propose(parameters.ir);
        return {
          tool,
          ok: result.committable,
          summary: summarise(result),
          diagnostics: result.diagnostics,
          proposal: result,
        };
      }

      case "commit_architecture": {
        return this.commit();
      }

      case "list_patterns": {
        const patterns = listPatterns();
        return {
          tool,
          ok: true,
          summary: `${patterns.length} patterns in ${[...new Set(patterns.map((p) => p.category))].length} categories.`,
          diagnostics: [],
          patternExpansion: undefined,
        };
      }

      case "expand_pattern": {
        const patternId = parameters.pattern as string | undefined;
        if (!patternId) {
          return {
            tool,
            ok: false,
            summary: 'expand_pattern requires { pattern: "<pattern-id>" }.',
            diagnostics: [],
          };
        }

        const pattern = findPattern(patternId);
        if (!pattern) {
          return {
            tool,
            ok: false,
            summary: `No pattern matches "${patternId}". Call list_patterns to see available patterns.`,
            diagnostics: [],
          };
        }

        const options: PatternExpandOptions = {};
        if (typeof parameters.prefix === "string") options.prefix = parameters.prefix;
        if (typeof parameters.tier === "string") options.tier = parameters.tier as Tier;
        if (parameters.wiring && typeof parameters.wiring === "object") {
          options.wiring = parameters.wiring as PatternExpandOptions["wiring"];
        }
        if (parameters.reuseExisting && typeof parameters.reuseExisting === "object") {
          options.reuseExisting = parameters.reuseExisting as Record<number, string>;
        }

        const expansion = expandPattern(pattern, options);

        return {
          tool,
          ok: true,
          summary:
            `Expanded "${pattern.name}" — ${expansion.nodes.length} nodes, ` +
            `${expansion.connections.length} connections. Merge nodes and connections into your IR ` +
            `and call propose_architecture.`,
          patternExpansion: {
            patternId: pattern.id,
            patternName: pattern.name,
            nodes: expansion.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              name: n.name,
              tier: n.tier,
            })),
            connections: expansion.connections.map((c) => ({
              id: c.id,
              from: c.from,
              to: c.to,
              label: c.label,
              intent: c.intent,
            })),
            indexToId: Object.fromEntries(expansion.indexToId),
          },
          diagnostics: [],
        };
      }

      default:
        return { tool, ok: false, summary: `Unknown architecture tool "${tool}".`, diagnostics: [] };
    }
  }
}
