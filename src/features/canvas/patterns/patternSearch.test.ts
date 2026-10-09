import { describe, expect, it } from "vitest";
import { PATTERNS } from "@/lib/catalogs/patterns";
import type { UserTemplate } from "@/features/diagram";
import { patternMatches, patternsForFilter, searchPatterns } from "./patternSearch";

const saved: UserTemplate = {
  id: "u1",
  name: "Fila de pedidos",
  createdAt: 0,
  components: [],
  connections: [],
};

describe("pattern search", () => {
  it("matches name, description and component names, ignoring accents and case", () => {
    expect(patternMatches(saved, "FILA")).toBe(true);
    expect(patternMatches(saved, "pédidos")).toBe(true);
    expect(patternMatches({ name: "x", components: [{ name: "Amazon SQS" }] }, "sqs")).toBe(true);
    expect(patternMatches(saved, "kafka")).toBe(false);
  });

  it("reads a concept word in any locale: 'fila' finds the English queue patterns", () => {
    const names = searchPatterns("fila", []).builtins.map((pattern) => pattern.name);
    expect(names).toContain("FIFO Queue (AWS SQS)");
  });

  it("counts every chip, and 'all' is built-ins plus saved templates", () => {
    const result = searchPatterns("", [saved]);
    expect(result.counts.all).toBe(PATTERNS.length + 1);
    expect(result.counts["user-templates"]).toBe(1);
    expect(result.counts.messaging).toBe(PATTERNS.filter((p) => p.category === "messaging").length);
  });

  it("narrows to a chip", () => {
    const result = searchPatterns("", [saved]);
    expect(patternsForFilter(result, "user-templates")).toEqual({
      builtins: [],
      userTemplates: [saved],
    });
    const api = patternsForFilter(result, "api");
    expect(api.userTemplates).toEqual([]);
    expect(api.builtins.every((pattern) => pattern.category === "api")).toBe(true);
  });
});
