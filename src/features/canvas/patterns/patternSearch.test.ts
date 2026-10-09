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
    const ids = searchPatterns("fila", []).builtins.map((pattern) => pattern.id);
    expect(ids).toContain("competing-consumers");
  });

  it("counts every chip, and 'all' is built-ins plus saved templates", () => {
    const result = searchPatterns("", [saved]);
    expect(result.counts.all).toBe(PATTERNS.length + 1);
    expect(result.counts["user-templates"]).toBe(1);
    expect(result.counts["integration-messaging"]).toBe(
      PATTERNS.filter((p) => p.category === "integration-messaging").length,
    );
  });

  it("narrows to a chip", () => {
    const result = searchPatterns("", [saved]);
    expect(patternsForFilter(result, "user-templates")).toEqual({
      builtins: [],
      userTemplates: [saved],
    });
    const messaging = patternsForFilter(result, "integration-messaging");
    expect(messaging.userTemplates).toEqual([]);
    expect(messaging.builtins.every((p) => p.category === "integration-messaging")).toBe(true);
  });
});
