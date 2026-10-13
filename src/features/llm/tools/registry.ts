import type { Tool, ToolSet } from "ai";
import type { z } from "zod";
import type { DiagramToolHost } from "./host";
import type { SuggestionDraft } from "./suggestion-draft";

export type ToolKind = "read" | "write";
export type ToolSource = "internal" | "mcp";

/** What a tool can reach while it runs: the diagram, and the turn's suggestion. */
export interface ToolContext {
  /** Tools only read the diagram; applying changes happens at Accept. */
  host: Pick<DiagramToolHost, "readDiagram">;
  /** Write tools queue their change here; nothing touches the diagram before Accept. */
  suggestion: SuggestionDraft;
}

/**
 * A tool the model can call. `description` is LLM-facing English and is not
 * translated. A tool never throws for bad input or unknown ids: it returns a
 * `ToolErrorResult` the model can read and correct.
 */
export interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  kind: ToolKind;
  source: ToolSource;
  /** The MCP server the tool comes from, when `source` is "mcp". */
  serverId?: string;
  execute: (input: TInput, context: ToolContext) => unknown;
}

/** What a tool returns when it cannot do what was asked. */
export interface ToolErrorResult {
  error: string;
}

export function toolError(message: string): ToolErrorResult {
  return { error: message };
}

export function isToolErrorResult(value: unknown): value is ToolErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string" &&
    Object.keys(value).length === 1
  );
}

/** Declares a tool with its input type inferred from the schema. */
export function defineTool<TSchema extends z.ZodType>(
  definition: Omit<ToolDefinition<z.infer<TSchema>>, "inputSchema"> & { inputSchema: TSchema },
): ToolDefinition {
  // The registry stores tools behind `unknown` input; the SDK validates input
  // against `inputSchema` before `execute` runs, so the narrowing holds.
  return {
    ...definition,
    execute: (input, context) => definition.execute(definition.inputSchema.parse(input), context),
  };
}

export interface ToolFilter {
  kind?: ToolKind;
  source?: ToolSource;
}

/** Every tool the chat can offer, by unique name. */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`A tool named "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * The SDK's tool set for the tools that match `filter`, bound to this turn's
   * context. Built from plain objects, so the SDK itself is not imported here.
   */
  toToolSet(context: ToolContext, filter: ToolFilter = {}): ToolSet {
    const toolSet: ToolSet = {};
    for (const definition of this.list(filter)) {
      const sdkTool: Tool = {
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: async (input: unknown) => definition.execute(input, context),
      };
      toolSet[definition.name] = sdkTool;
    }
    return toolSet;
  }

  list(filter: ToolFilter = {}): ToolDefinition[] {
    return [...this.tools.values()].filter(
      (tool) =>
        (filter.kind === undefined || tool.kind === filter.kind) &&
        (filter.source === undefined || tool.source === filter.source),
    );
  }
}
