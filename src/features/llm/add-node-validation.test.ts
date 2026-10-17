import { describe, expect, it } from "vitest";
import { validateAddNodeAgainstRegistry } from "./add-node-validation";
import { buildComponentTypeCatalog } from "./component-catalog";

// add_node runs this check before queuing a node; the tool-level behaviour
// (an error result back to the model, nothing queued) is in tools/internal-tools.test.ts.
describe("add_node registry validation", () => {
  it("rejects unknown nodeType against the registry", () => {
    expect(validateAddNodeAgainstRegistry("not-a-real-type", "redis").ok).toBe(false);
  });

  it("rejects serviceId that does not belong to the category", () => {
    const result = validateAddNodeAgainstRegistry("oss-datastore", "kafka");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("kafka");
  });

  it("rejects cloud category without serviceId", () => {
    expect(validateAddNodeAgainstRegistry("oss-datastore").ok).toBe(false);
  });

  it("accepts Redis under oss-datastore and Lambda under aws-compute", () => {
    expect(validateAddNodeAgainstRegistry("oss-datastore", "redis").ok).toBe(true);
    expect(validateAddNodeAgainstRegistry("aws-compute", "lambda").ok).toBe(true);
  });

  it("rejects an invented pair", () => {
    expect(validateAddNodeAgainstRegistry("aws-compute", "not-a-service").ok).toBe(false);
    expect(validateAddNodeAgainstRegistry("aws-invented", "lambda").ok).toBe(false);
    expect(validateAddNodeAgainstRegistry("oss-datastore", "lambda").ok).toBe(false);
  });

  it("accepts structural types without serviceId", () => {
    expect(validateAddNodeAgainstRegistry("system").ok).toBe(true);
  });

  it("tells the model to search without threatening to drop unmatched writes", () => {
    const catalog = buildComponentTypeCatalog();
    expect(catalog).toContain("search_elements");
    expect(catalog).not.toContain("unmatched add_node calls are skipped");
  });
});
