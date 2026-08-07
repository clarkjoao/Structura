import { describe, expect, it } from "vitest";
import { AWS_SERVICE_MAP } from "@/lib/catalogs/aws";
import { buildIRSystemPrompt } from "./ir-prompt";
import { parseAndValidateIR } from "./ir-validator";
import { IR_SEMANTIC_TYPES, IR_TIERS } from "./ir.types";

const prompt = buildIRSystemPrompt("en");

/** Every `{ ... }` JSON object shown to the model as a worked example. */
function exampleDocuments(): string[] {
  return prompt.match(/^\{$[\s\S]*?^\}$/gm) ?? [];
}

describe("buildIRSystemPrompt", () => {
  it("documents every semanticType and tier the validator accepts", () => {
    for (const semanticType of IR_SEMANTIC_TYPES) {
      expect(prompt, `semanticType ${semanticType}`).toContain(`"${semanticType}"`);
    }
    for (const tier of IR_TIERS) {
      expect(prompt, `tier ${tier}`).toContain(`"${tier}"`);
    }
  });

  it("documents the awsService and isBoundary fields", () => {
    expect(prompt).toContain("awsService");
    expect(prompt).toContain("isBoundary");
  });

  it("shows at least one C4 and one AWS example", () => {
    const documents = exampleDocuments();
    expect(documents.length).toBeGreaterThanOrEqual(2);
  });

  it("only shows examples that the validator accepts", () => {
    for (const document of exampleDocuments()) {
      const result = parseAndValidateIR(document);
      const issues = result.ok ? [] : result.issues;
      expect(issues, `example failed validation: ${JSON.stringify(issues)}`).toHaveLength(0);
    }
  });

  it("only names awsService ids that exist in the catalog", () => {
    // `elb` is the catalog's id for load balancing — `alb` does not exist, and a
    // wrong id here teaches the model to emit something that resolves to nothing.
    for (const document of exampleDocuments()) {
      for (const match of document.matchAll(/"awsService":\s*"([^"]+)"/g)) {
        expect(AWS_SERVICE_MAP.has(match[1]), `unknown awsService "${match[1]}"`).toBe(true);
      }
    }
  });
});
