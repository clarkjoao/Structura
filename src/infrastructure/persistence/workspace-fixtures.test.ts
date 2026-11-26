import { describe, expect, it } from "vitest";
import { fixture, jsonFixture } from "@/lib/export-service/__fixtures__/load";
import { exportJSON } from "@/lib/export-service/export-json";
import { DIAGRAM_SCHEMA_URI } from "./versions";
import { validateDiagramFile } from "./validateWorkspaceFile";

/** Committed workspace JSON fixtures (src/lib/export-service/__fixtures__/workspace). */

describe("workspace JSON fixtures", () => {
  it("the current-schema export validates and keeps its content", () => {
    const raw = jsonFixture("workspace/diagram-current.json");
    expect((raw as { $schema: string }).$schema).toBe(DIAGRAM_SCHEMA_URI);
    const result = validateDiagramFile(raw);
    if (!result.valid) throw new Error(result.reason);
    expect(Object.keys(result.diagram.snapshot.components).sort()).toEqual(["api", "db", "user"]);
    expect(result.diagram.snapshot.connections.e1?.label).toBe("uses");
  });

  // Old-schema file inside the versioned envelope (schemaVersion 0): legacy connection semantics
  // and a corrupted type string are migrated.
  it("an old-schema file migrates to the current model", () => {
    const result = validateDiagramFile(jsonFixture("workspace/diagram-v0-enveloped.json"));
    if (!result.valid) throw new Error(result.reason);
    const { components, connections } = result.diagram.snapshot;
    expect(components.api?.type).toBe("unknown");
    const e1 = connections.e1!;
    expect(e1).not.toHaveProperty("intent");
    expect(e1).not.toHaveProperty("transportPreset");
    expect(e1.direction).not.toBe("reverse");
    // A "reverse" edge is flipped into a forward one; its label survives.
    expect(e1).toMatchObject({ sourceId: "api", targetId: "user", label: "uses" });
  });

  it("migrating twice is a no-op (idempotent)", () => {
    const first = validateDiagramFile(jsonFixture("workspace/diagram-v0-enveloped.json"));
    if (!first.valid) throw new Error(first.reason);
    const second = validateDiagramFile(first.diagram);
    if (!second.valid) throw new Error(second.reason);
    expect(second.diagram.snapshot).toEqual(first.diagram.snapshot);
  });

  // Gap found while building the corpus: a bare legacy file (no $schema envelope) is documented as
  // "schema version 0" but validateDiagramFile never runs migrateDiagram on it, so its corrupted
  // component type and legacy connection fields reach the store unmigrated.
  it.fails("a bare legacy file (no envelope) is migrated like a versioned one", () => {
    const result = validateDiagramFile(jsonFixture("workspace/diagram-legacy-v0.json"));
    if (!result.valid) throw new Error(result.reason);
    expect(result.diagram.snapshot.components.api?.type).toBe("unknown");
  });

  it("current fixture -> exportJSON -> validate keeps ids, parents, labels and layouts", () => {
    const first = validateDiagramFile(jsonFixture("workspace/diagram-current.json"));
    if (!first.valid) throw new Error(first.reason);
    const second = validateDiagramFile(JSON.parse(exportJSON(first.diagram)));
    if (!second.valid) throw new Error(second.reason);
    expect(second.diagram.snapshot).toEqual(first.diagram.snapshot);
    expect(second.diagram.nodeLayouts).toEqual(first.diagram.nodeLayouts);
  });

  it("a file from a newer schema is refused, not half-read", () => {
    const result = validateDiagramFile(jsonFixture("workspace/diagram-future-schema.json"));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/Unsupported diagram schema version: 99/);
  });

  // ac72766c: user SVG is sanitized at every import path; this is the workspace-file one.
  it("a workspace file with a hostile SVG component is sanitized on import", () => {
    const result = validateDiagramFile(jsonFixture("workspace/diagram-hostile-svg.json"));
    if (!result.valid) throw new Error(result.reason);
    const svg = (result.diagram.snapshot.components.logo as { svgContent: string }).svgContent;
    expect(svg).toContain("<rect");
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son\w+\s*=/i);
  });

  it("the hostile fixture is hostile on disk", () => {
    expect(fixture("workspace/diagram-hostile-svg.json")).toMatch(/<script>/);
  });
});
