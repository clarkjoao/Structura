import { describe, expect, it } from "vitest";
import { PATTERNS } from "@/lib/catalogs/patterns";
import { listPatterns } from "./pattern-catalog-query";
import { parseLLMResponse } from "./patch-parser";
import { runCatalogReadActions } from "./apply-diagram-patch";
import { buildPatternCatalogCompact } from "./component-catalog";

describe("list_patterns", () => {
  it("returns every pattern in English with its roles, and the accepted providers", () => {
    const result = listPatterns();
    expect(result.patterns.map((p) => p.id)).toEqual(PATTERNS.map((p) => p.id));
    const fanOut = result.patterns.find((p) => p.id === "fan-out")!;
    expect(fanOut.name).toBe("Fan-out (topic → queues)");
    expect(fanOut.roles).toEqual(["topic", "queue"]);
    expect(result.providers).toEqual(expect.arrayContaining(["neutral", "aws", "gcp", "azure"]));
  });

  it("is a catalog read: parsed into an action and answered before writes", () => {
    const parsed = parseLLMResponse(
      JSON.stringify({
        message: "m",
        patch: {
          id: "p",
          description: "d",
          actions: [],
          toolCalls: [{ tool: "list_patterns", parameters: {} }],
        },
      }),
    );
    const actions = parsed.kind === "patch" ? (parsed.patch?.actions ?? []) : [];
    expect(actions).toEqual([{ type: "LIST_PATTERNS", payload: {} }]);
    const { catalogToolResults } = runCatalogReadActions(actions);
    expect(catalogToolResults[0]?.type).toBe("LIST_PATTERNS");
  });

  it("is what the system prompt lists, category by category", () => {
    const prompt = buildPatternCatalogCompact();
    for (const pattern of PATTERNS) expect(prompt).toContain(pattern.id);
    expect(prompt).toContain("INTEGRATION-MESSAGING");
  });
});
