import { describe, expect, it } from "vitest";
import type { Component, Diagram, VersionDiff } from "@/features/diagram";
import { resolveVersionSnapshot } from "@/features/diagram";
import { validateDiagramFile } from "@/infrastructure/persistence/validateWorkspaceFile";
import { exportJSON } from "./export-json";

/**
 * Scenes are diagram content: exportJSON must preserve them whether or not a
 * scene is active. Snapshot stays the base; VersionDiffs stay diffs over it.
 */

function baseComponent(id: string, name: string): Component {
  return {
    id,
    name,
    description: "",
    parentId: null,
    type: "system",
  };
}

function sceneDiff(overrides: Partial<VersionDiff> & Pick<VersionDiff, "id" | "name">): VersionDiff {
  return {
    color: "#6366f1",
    createdAt: 1,
    addedComponents: {},
    addedConnections: {},
    removedComponentIds: [],
    removedConnectionIds: [],
    nodeLayouts: {},
    ...overrides,
  };
}

function diagramWithScenes(activeVersionId: string | null | undefined): Diagram {
  const base: Component = baseComponent("base-1", "Base System");
  const sceneOnly: Component = baseComponent("scene-1", "Scene Only");
  const scene = sceneDiff({
    id: "sc1",
    name: "Future",
    addedComponents: { [sceneOnly.id]: sceneOnly },
    nodeLayouts: { [sceneOnly.id]: { elementId: sceneOnly.id, x: 100, y: 100 } },
  });

  return {
    id: "d1",
    name: "Scenes export",
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components: { [base.id]: base },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { [base.id]: { elementId: base.id, x: 0, y: 0 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    versions: { [scene.id]: scene },
    ...(activeVersionId !== undefined ? { activeVersionId } : {}),
  };
}

describe("exportJSON — scenes as content", () => {
  it("preserves scenes when a scene is active (does not flatten/drop)", () => {
    const diagram = diagramWithScenes("sc1");
    const parsed = JSON.parse(exportJSON(diagram)) as {
      data: Diagram;
    };

    expect(parsed.data.versions).toBeDefined();
    expect(Object.keys(parsed.data.versions!)).toEqual(["sc1"]);
    expect(parsed.data.versions!.sc1.addedComponents["scene-1"]?.name).toBe("Scene Only");
    expect(parsed.data.activeVersionId).toBe("sc1");
    // Base snapshot is not flattened — scene-only component stays out of base
    expect(parsed.data.snapshot.components["scene-1"]).toBeUndefined();
    expect(parsed.data.snapshot.components["base-1"]).toBeDefined();
  });

  it("preserves scenes when no scene is active", () => {
    const diagram = diagramWithScenes(null);
    const parsed = JSON.parse(exportJSON(diagram)) as { data: Diagram };

    expect(parsed.data.versions).toBeDefined();
    expect(Object.keys(parsed.data.versions!)).toEqual(["sc1"]);
    expect(parsed.data.activeVersionId).toBeNull();
  });

  it("round-trips: reimport recovers all scenes and active scene still resolves", () => {
    const diagram = diagramWithScenes("sc1");
    const json = exportJSON(diagram);
    const validation = validateDiagramFile(JSON.parse(json));
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    const imported = validation.diagram;
    expect(imported.versions).toBeDefined();
    expect(Object.keys(imported.versions!)).toEqual(["sc1"]);
    expect(imported.activeVersionId).toBe("sc1");
    expect(imported.snapshot.components["base-1"]).toBeDefined();
    expect(imported.snapshot.components["scene-1"]).toBeUndefined();

    const resolved = resolveVersionSnapshot(imported, "sc1");
    expect(resolved.components["base-1"]).toBeDefined();
    expect(resolved.components["scene-1"]?.name).toBe("Scene Only");
  });
});
