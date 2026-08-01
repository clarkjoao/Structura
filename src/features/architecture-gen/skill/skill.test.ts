import { describe, it, expect } from "vitest";
import { ARCHITECTURE_SKILL, isSkillLoaded } from "./index";
import { buildSystemPrompt } from "@/features/llm/prompt-builder";
import { parseArchitectureIr } from "../ir";
import { ProposalSession } from "../session";

/** Every diagnostic code the validators and engine can emit at the model. */
const EMITTED_CODES = [
  "ir/unknown-node-ref",
  "ir/duplicate-id",
  "ir/node-in-two-boundaries",
  "node/overlap",
  "node/clipped-label",
  "edge/crosses-node",
  "edge/arrowhead-clearance",
  "label/clearance",
  "flow/non-monotonic",
  "flow/orphan-node",
  "c4/cross-cutting-no-entry",
  "c4/too-many-primary",
  "layout/tier-not-in-layout",
];

describe("skill loading", () => {
  it("ships with the bundle", () => {
    // An empty import would leave the model with tools and no instructions, which fails as
    // bad diagrams rather than as an error.
    expect(isSkillLoaded()).toBe(true);
    expect(ARCHITECTURE_SKILL).toContain("Generating architecture diagrams");
  });
});

describe("skill content", () => {
  it("states the core rule", () => {
    expect(ARCHITECTURE_SKILL).toMatch(/You describe intent\. Structura resolves geometry\./);
  });

  it("names every tier the IR accepts", () => {
    for (const tier of [
      "external",
      "client",
      "gateway",
      "application",
      "backend",
      "data",
      "cross-cutting",
    ]) {
      expect(ARCHITECTURE_SKILL, tier).toContain(tier);
    }
  });

  it("documents every diagnostic the model can receive", () => {
    // A code with no entry leaves the model guessing at the fix.
    for (const code of EMITTED_CODES) {
      expect(ARCHITECTURE_SKILL, code).toContain(code);
    }
  });

  it("covers the three tools in workflow order", () => {
    const propose = ARCHITECTURE_SKILL.indexOf("propose_architecture");
    const refine = ARCHITECTURE_SKILL.indexOf("refine_architecture");
    const commit = ARCHITECTURE_SKILL.indexOf("commit_architecture");

    expect(propose).toBeGreaterThan(-1);
    expect(refine).toBeGreaterThan(propose);
    expect(commit).toBeGreaterThan(refine);
  });

  it("bounds elicitation rather than demanding it", () => {
    expect(ARCHITECTURE_SKILL).toMatch(/at most three questions/i);
    expect(ARCHITECTURE_SKILL).toMatch(/Skip all of it/i);
  });

  it("states the round cap and the stall rule", () => {
    expect(ARCHITECTURE_SKILL).toMatch(/3 rounds/);
    expect(ARCHITECTURE_SKILL).toMatch(/two consecutive rounds/i);
  });

  it("explains why cross-cutting has no edges", () => {
    expect(ARCHITECTURE_SKILL).toMatch(/no edges drawn by default/i);
  });

  it("warns off auto_layout as a fallback", () => {
    expect(ARCHITECTURE_SKILL).toMatch(/auto_layout/);
    expect(ARCHITECTURE_SKILL).toMatch(/looks finished and is not/i);
  });

  it("gives the primary path a layout role, not just emphasis", () => {
    expect(ARCHITECTURE_SKILL).toMatch(/order nodes within their columns/i);
  });
});

describe("the worked example is real", () => {
  /** Extracts the JSON block from the example section. */
  function exampleIr(): unknown {
    const match = ARCHITECTURE_SKILL.match(/```json\n([\s\S]*?)```/);
    expect(match, "skill must contain a JSON example").not.toBeNull();
    return JSON.parse(match![1]!);
  }

  it("parses against the real schema", () => {
    // An example the schema rejects would teach the model to fail.
    const result = parseArchitectureIr(exampleIr());
    expect(result.ok, result.ok ? "" : JSON.stringify(result.issues)).toBe(true);
  });

  it("lays out and validates cleanly", () => {
    const result = new ProposalSession().propose(exampleIr());
    expect(result.status, result.diagnostics[0]?.message).toBe("ok");
    expect(result.errors).toBe(0);
  });

  it("contains no geometry", () => {
    const serialised = JSON.stringify(exampleIr());
    for (const banned of ['"x"', '"y"', '"width"', '"height"', '"position"']) {
      expect(serialised, banned).not.toContain(banned);
    }
  });
});

describe("system prompt integration", () => {
  const prompt = buildSystemPrompt("(empty diagram)", "en");

  it("includes the skill", () => {
    expect(prompt).toContain("You describe intent. Structura resolves geometry.");
  });

  it("puts the skill before the patch-action rules", () => {
    // The model should read "never geometry" before it reads anything about ADD_NODE.
    expect(prompt.indexOf("Structura resolves geometry")).toBeLessThan(
      prompt.indexOf("Diagram patch actions"),
    );
  });

  it("no longer tells the model to include a position", () => {
    // This guidance contradicted the whole design and survived slice 0's tool changes.
    expect(prompt).not.toMatch(/Always include "position"/);
    expect(prompt).not.toMatch(/Horizontal spacing: \d+px/);
    expect(prompt).not.toMatch(/Start positions around x:\d+/);
  });

  it("has no example emitting coordinates", () => {
    expect(prompt).not.toMatch(/"position":\s*\{\s*"x"/);
  });

  it("routes whole-diagram generation to propose_architecture", () => {
    expect(prompt).toContain("propose_architecture");
    expect(prompt).toMatch(/SINGLE EDITS/);
  });

  it("keeps the AWS component-selection guidance", () => {
    // Slice 0's demotion must not have cost the specific-AWS-type rule.
    expect(prompt).toMatch(/aws-storage/);
    expect(prompt).toMatch(/awsService/);
  });

  it("works in both locales", () => {
    for (const locale of ["en", "pt-BR"]) {
      expect(buildSystemPrompt("(empty)", locale)).toContain("Structura resolves geometry");
    }
  });
});
