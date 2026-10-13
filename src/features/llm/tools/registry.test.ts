import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool, ToolRegistry, type ToolContext } from "./registry";
import { SuggestionDraft } from "./suggestion-draft";

const context: ToolContext = {
  host: { readDiagram: () => null },
  suggestion: new SuggestionDraft(),
};

const echo = defineTool({
  name: "echo",
  description: "Echoes its input.",
  inputSchema: z.object({ text: z.string() }),
  kind: "read",
  source: "internal",
  execute: ({ text }) => ({ text }),
});

const remote = defineTool({
  name: "remote_write",
  description: "A write tool from an MCP server.",
  inputSchema: z.object({}),
  kind: "write",
  source: "mcp",
  serverId: "github",
  execute: () => ({ ok: true }),
});

describe("ToolRegistry", () => {
  it("refuses a duplicate name", () => {
    const registry = new ToolRegistry();
    registry.register(echo);
    expect(() => registry.register(echo)).toThrow(/already registered/);
  });

  it("gets tools by name and filters by kind and source", () => {
    const registry = new ToolRegistry();
    registry.register(echo);
    registry.register(remote);
    expect(registry.get("echo")).toBe(echo);
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.list({ kind: "read" }).map((tool) => tool.name)).toEqual(["echo"]);
    expect(registry.list({ source: "mcp" }).map((tool) => tool.name)).toEqual(["remote_write"]);
    expect(registry.list()).toHaveLength(2);
  });

  it("converts to an SDK tool set bound to the turn's context", async () => {
    const registry = new ToolRegistry();
    registry.register(echo);
    registry.register(remote);
    const toolSet = registry.toToolSet(context, { source: "internal" });
    expect(Object.keys(toolSet)).toEqual(["echo"]);
    expect(toolSet.echo?.description).toBe("Echoes its input.");
    const result = await toolSet.echo?.execute?.(
      { text: "hi" },
      { toolCallId: "c", messages: [], context: {} },
    );
    expect(result).toEqual({ text: "hi" });
  });
});
