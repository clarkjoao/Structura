import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { validateDiagramFile } from "./validateWorkspaceFile";
import { DIAGRAM_SCHEMA_URI, DIAGRAM_SCHEMA_VERSION } from "./versions";
import { diagramsEqualForFolderSync } from "./workspace-folder-sync-equality";

const diagram: Diagram = {
  id: "d",
  name: "Checkout",
  level: "context",
  createdAt: 1,
  updatedAt: 1,
  snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
  nodeLayouts: {},
  edgeLayouts: {},
  viewport: { x: 0, y: 0, zoom: 1 },
  kind: "acme:value-stream",
  kindMode: "freehand",
  kindData: { flowId: "f1" },
};

describe("folder file — diagram kind", () => {
  it("round-trips the kind fields through the file format unchanged", () => {
    const file = JSON.parse(
      JSON.stringify({
        $schema: DIAGRAM_SCHEMA_URI,
        schemaVersion: DIAGRAM_SCHEMA_VERSION,
        data: diagram,
      }),
    ) as unknown;
    const result = validateDiagramFile(file);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.diagram.kind).toBe("acme:value-stream");
    expect(result.diagram.kindMode).toBe("freehand");
    expect(result.diagram.kindData).toEqual({ flowId: "f1" });
  });

  it("writes to the folder when only the kind mode changes", () => {
    const { kindMode: _mode, ...guided } = diagram;
    expect(diagramsEqualForFolderSync(diagram, guided)).toBe(false);
  });
});
