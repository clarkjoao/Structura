import { describe, expect, it } from "vitest";
import { buildIRFilename, serializeIR } from "./ir-export";
import { validateIR } from "./ir-validator";
import type { DiagramIR } from "./ir.types";

const ir: DiagramIR = {
  type: "aws-deployment",
  nodes: [
    {
      id: "vpc",
      semanticType: "aws-vpc",
      name: "Prod",
      awsService: "vpc",
      parentId: null,
      isBoundary: true,
      tier: "edge",
    },
    {
      id: "fn",
      semanticType: "aws-compute",
      name: "Handler",
      awsService: "lambda",
      parentId: "vpc",
      tier: "compute",
    },
  ],
  edges: [{ id: "e1", sourceId: "vpc", targetId: "fn", label: "hosts" }],
};

describe("buildIRFilename", () => {
  it("names the file after the diagram type and an ISO timestamp", () => {
    expect(buildIRFilename(ir, new Date("2026-08-04T15:30:45.123Z"))).toBe(
      "structura-ir-aws-deployment-2026-08-04T15-30-45.json",
    );
  });

  it("keeps colons and dots out of the stem, which break filenames on Windows", () => {
    const stem = buildIRFilename(ir, new Date("2026-01-02T03:04:05.006Z")).replace(/\.json$/, "");
    expect(stem).not.toMatch(/[:.]/);
  });
});

describe("serializeIR", () => {
  it("round-trips back through the validator", () => {
    const result = validateIR(JSON.parse(serializeIR(ir)));
    expect(result.ok).toBe(true);
  });

  it("writes indented JSON ending in a newline, so the file is diffable", () => {
    const text = serializeIR(ir);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "nodes"');
  });
});
